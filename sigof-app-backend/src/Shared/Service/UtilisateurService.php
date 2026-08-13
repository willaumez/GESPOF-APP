<?php

declare(strict_types=1);

namespace App\Shared\Service;

use App\Shared\Entite\Utilisateur;
use App\Shared\Enum\ActionAutorisee;
use App\Shared\Enum\Portail;
use App\Shared\Enum\RoleAcces;
use App\Shared\Repository\UtilisateurRepository;
use App\Shared\Exception\ActionInterditeException;
use App\Shared\Exception\DonneesInvalidesException;
use App\Shared\Exception\IdentifiantDejaUtiliseException;
use App\Shared\Exception\UtilisateurAvecActiviteException;
use App\Shared\Exception\UtilisateurIntrouvableException;
use Symfony\Component\PasswordHasher\Hasher\UserPasswordHasherInterface;

/**
 * Gestion des utilisateurs — transverse à tous les portails (déplacé hors de
 * Module/ServiceReglement, où il était câblé en dur sur AGENT_SR/CHEF_SR
 * uniquement). Un utilisateur se voit attribuer un seul métier (RoleAcces) à
 * la création ; le portail et les actions autorisées en découlent
 * automatiquement (RoleAcces::portail()/actions()), pas de saisie manuelle.
 *
 * Portée de gestion : un ADMINISTRATEUR gère tous les métiers ; un métier
 * "chef" (ou l'administrateur) gère les métiers de son propre portail ; un
 * "agent" ne gère aucun utilisateur (pas d'action SUPPRIMER, condition
 * utilisée ici comme marqueur "gère les utilisateurs de son portail").
 */
class UtilisateurService implements UtilisateurServiceInterface
{
    public function __construct(
        private readonly UtilisateurRepository $utilisateurRepository,
        private readonly UserPasswordHasherInterface $passwordHasher,
        private readonly UtilisateurActiviteVerifierInterface $activiteVerifier,
    ) {
    }

    public function lister(Utilisateur $utilisateurConnecte, string $search, ?string $role, ?string $statut, int $page, string $limitRaw): array
    {
        $rolesAutorises = $this->rolesGerablesPar($utilisateurConnecte);

        $roleFiltre = null;
        if ($role !== null && $role !== '') {
            $roleFiltre = RoleAcces::tryFrom($role);
            if ($roleFiltre === null || !in_array($roleFiltre, $rolesAutorises, true)) {
                throw new DonneesInvalidesException('Ce role n\'est pas gerable par votre metier.');
            }
        }

        $actifFiltre = match ($statut) {
            'actif' => true,
            'inactif' => false,
            default => null,
        };

        $page = max(1, $page);
        $limitRaw = trim($limitRaw);
        $toutAfficher = $limitRaw === 'all';
        $limit = $toutAfficher ? 0 : max(1, (int) $limitRaw);

        $resultat = $this->utilisateurRepository->listerPagine(
            $rolesAutorises,
            $search,
            $roleFiltre,
            $actifFiltre,
            $page,
            $limit,
            $toutAfficher,
        );

        $total = $resultat['total'];
        $totalPages = $toutAfficher ? 1 : max(1, (int) ceil($total / $limit));
        $page = $toutAfficher ? 1 : min($page, $totalPages);

        return [
            'utilisateurs' => array_map(
                static fn (Utilisateur $u): array => $u->jsonSerialize(),
                $resultat['utilisateurs'],
            ),
            'pagination' => [
                'page' => $page,
                'limit' => $toutAfficher ? $total : $limit,
                'total' => $total,
                'total_pages' => $totalPages,
            ],
        ];
    }

    public function detail(Utilisateur $utilisateurConnecte, int $id): array
    {
        return $this->trouverUtilisateurGere($utilisateurConnecte, $id)->jsonSerialize();
    }

    public function creer(Utilisateur $utilisateurConnecte, array $data): array
    {
        $matricule = trim((string) ($data['matricule'] ?? ''));
        $email = trim((string) ($data['email'] ?? ''));
        $nom = trim((string) ($data['nom'] ?? ''));
        $prenom = trim((string) ($data['prenom'] ?? ''));
        $metier = $this->resoudreMetier($data['metier'] ?? $data['role'] ?? null);
        $motDePasseFourni = trim((string) ($data['mot_de_passe'] ?? ''));

        if (!$this->peutGererMetier($utilisateurConnecte, $metier)) {
            throw new ActionInterditeException('Vous ne pouvez pas assigner ce metier.');
        }

        if ($matricule === '' || $email === '' || $nom === '' || $prenom === '') {
            throw new DonneesInvalidesException('Les champs matricule, email, nom et prenom sont requis.');
        }

        if ($motDePasseFourni !== '' && mb_strlen($motDePasseFourni) < 8) {
            throw new DonneesInvalidesException('Le mot de passe doit contenir au moins 8 caracteres.');
        }

        if ($this->utilisateurRepository->findOneBy(['matricule' => $matricule]) !== null) {
            throw new IdentifiantDejaUtiliseException('Ce matricule est deja utilise.');
        }
        if ($this->utilisateurRepository->findOneBy(['email' => $email]) !== null) {
            throw new IdentifiantDejaUtiliseException('Cet email est deja utilise.');
        }

        $utilisateur = new Utilisateur();
        $utilisateur->setMatricule($matricule);
        $utilisateur->setEmail($email);
        $utilisateur->setNom($nom);
        $utilisateur->setPrenom($prenom);
        $utilisateur->setRolesAcces([$metier]);
        $utilisateur->setActif(true);
        $utilisateur->setConnection('first');

        $motDePasseGenere = $motDePasseFourni === '' ? $this->genererMotDePasseTemporaire() : null;
        $utilisateur->setMotDePasseHash($this->passwordHasher->hashPassword($utilisateur, $motDePasseGenere ?? $motDePasseFourni));

        $this->utilisateurRepository->save($utilisateur, true);

        $resultat = $utilisateur->jsonSerialize();
        if ($motDePasseGenere !== null) {
            $resultat['mot_de_passe_temporaire'] = $motDePasseGenere;
        }

        return $resultat;
    }

    public function modifier(Utilisateur $utilisateurConnecte, int $id, array $data): array
    {
        $utilisateur = $this->trouverUtilisateurGere($utilisateurConnecte, $id);

        if (array_key_exists('nom', $data)) {
            $nom = trim((string) $data['nom']);
            if ($nom === '') {
                throw new DonneesInvalidesException('Le nom ne peut pas etre vide.');
            }
            $utilisateur->setNom($nom);
        }

        if (array_key_exists('prenom', $data)) {
            $prenom = trim((string) $data['prenom']);
            if ($prenom === '') {
                throw new DonneesInvalidesException('Le prenom ne peut pas etre vide.');
            }
            $utilisateur->setPrenom($prenom);
        }

        if (array_key_exists('metier', $data) || array_key_exists('role', $data)) {
            $nouveauMetier = $this->resoudreMetier($data['metier'] ?? $data['role']);
            if (!$this->peutGererMetier($utilisateurConnecte, $nouveauMetier)) {
                throw new ActionInterditeException('Vous ne pouvez pas assigner ce metier.');
            }
            $utilisateur->setRolesAcces([$nouveauMetier]);
        }

        $this->utilisateurRepository->flush();

        return $utilisateur->jsonSerialize();
    }

    public function desactiver(Utilisateur $utilisateurConnecte, int $id): void
    {
        $utilisateur = $this->trouverUtilisateurGere($utilisateurConnecte, $id);
        $utilisateur->setActif(false);
        $this->utilisateurRepository->flush();
    }

    public function reactiver(Utilisateur $utilisateurConnecte, int $id): void
    {
        $utilisateur = $this->trouverUtilisateurGere($utilisateurConnecte, $id);
        $utilisateur->setActif(true);
        $this->utilisateurRepository->flush();
    }

    public function supprimer(Utilisateur $utilisateurConnecte, int $id): void
    {
        $utilisateur = $this->trouverUtilisateurGere($utilisateurConnecte, $id);

        if ($utilisateur->getId() === $utilisateurConnecte->getId()) {
            throw new ActionInterditeException('Vous ne pouvez pas supprimer votre propre compte.');
        }

        if ($this->activiteVerifier->aDeLActivite($id)) {
            throw new UtilisateurAvecActiviteException(
                'Cet utilisateur a des donnees associees et ne peut pas etre supprime definitivement. Desactivez-le a la place.',
            );
        }

        $this->utilisateurRepository->remove($utilisateur, true);
    }

    public function reinitialiserMotDePasse(Utilisateur $utilisateurConnecte, int $id): array
    {
        $utilisateur = $this->trouverUtilisateurGere($utilisateurConnecte, $id);

        $motDePasseTemporaire = $this->genererMotDePasseTemporaire();
        $utilisateur->setMotDePasseHash($this->passwordHasher->hashPassword($utilisateur, $motDePasseTemporaire));
        $utilisateur->setConnection('first');
        $this->utilisateurRepository->flush();

        return ['mot_de_passe_temporaire' => $motDePasseTemporaire];
    }

    /**
     * Portails geres par cet utilisateur (`null` = tous, reserve a
     * ADMINISTRATEUR). Un metier gere les utilisateurs de son portail des
     * lors qu'il a l'action SUPPRIMER (chefs + administrateur) ; les agents
     * et les metiers transverses (sans action SUPPRIMER) ne gerent personne.
     *
     * @return Portail[]|null
     */
    private function portailsGeresPar(Utilisateur $utilisateurConnecte): ?array
    {
        $roles = $utilisateurConnecte->getRolesAcces();

        if (in_array(RoleAcces::ADMINISTRATEUR, $roles, true)) {
            return null;
        }

        $portails = [];
        foreach ($roles as $role) {
            $portail = $role->portail();
            if ($portail !== null && in_array(ActionAutorisee::SUPPRIMER, $role->actions(), true)) {
                $portails[] = $portail;
            }
        }

        return array_values(array_unique($portails, SORT_REGULAR));
    }

    /**
     * @return RoleAcces[]
     */
    private function rolesGerablesPar(Utilisateur $utilisateurConnecte): array
    {
        $portailsGeres = $this->portailsGeresPar($utilisateurConnecte);
        if ($portailsGeres === null) {
            return RoleAcces::cases();
        }

        return array_values(array_filter(
            RoleAcces::cases(),
            static fn (RoleAcces $r): bool => $r->portail() !== null && in_array($r->portail(), $portailsGeres, true),
        ));
    }

    private function peutGererMetier(Utilisateur $utilisateurConnecte, RoleAcces $metier): bool
    {
        return in_array($metier, $this->rolesGerablesPar($utilisateurConnecte), true);
    }

    private function trouverUtilisateurGere(Utilisateur $utilisateurConnecte, int $id): Utilisateur
    {
        $utilisateur = $this->utilisateurRepository->find($id);
        $rolesGerables = $this->rolesGerablesPar($utilisateurConnecte);

        $accessible = $utilisateur !== null
            && array_any($rolesGerables, static fn (RoleAcces $r): bool => $utilisateur->hasRoleAcces($r));

        if (!$accessible) {
            throw new UtilisateurIntrouvableException('Utilisateur introuvable.');
        }

        return $utilisateur;
    }

    private function resoudreMetier(mixed $metier): RoleAcces
    {
        if (is_array($metier)) {
            $metier = $metier[0] ?? null;
        }

        $resolu = is_string($metier) ? RoleAcces::tryFrom($metier) : null;
        if ($resolu === null) {
            throw new DonneesInvalidesException('Le metier fourni est invalide.');
        }

        return $resolu;
    }

    private function genererMotDePasseTemporaire(): string
    {
        return bin2hex(random_bytes(5));
    }
}
