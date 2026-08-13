<?php

declare(strict_types=1);

namespace App\Implementation\ServiceReglement;

use App\Entity\Utilisateur;
use App\Enum\RoleAcces;
use App\Repository\ServiceReglement\FicheDepotRepository;
use App\Repository\ServiceReglement\HistoriqueFicheRepository;
use App\Repository\UtilisateurRepository;
use App\Service\ServiceReglement\Exception\ActionInterditeException;
use App\Service\ServiceReglement\Exception\DonneesInvalidesException;
use App\Service\ServiceReglement\Exception\IdentifiantDejaUtiliseException;
use App\Service\ServiceReglement\Exception\UtilisateurAvecActiviteException;
use App\Service\ServiceReglement\Exception\UtilisateurIntrouvableException;
use App\Service\ServiceReglement\UtilisateurServiceInterface;
use Symfony\Component\PasswordHasher\Hasher\UserPasswordHasherInterface;

class UtilisateurService implements UtilisateurServiceInterface
{
    private const array ROLES_SR = [RoleAcces::AGENT_SR, RoleAcces::CHEF_SR];

    public function __construct(
        private readonly UtilisateurRepository $utilisateurRepository,
        private readonly UserPasswordHasherInterface $passwordHasher,
        private readonly FicheDepotRepository $ficheDepotRepository,
        private readonly HistoriqueFicheRepository $historiqueFicheRepository,
    ) {
    }

    public function lister(string $search, ?string $role, ?string $statut, int $page, string $limitRaw): array
    {
        $roleFiltre = null;
        if ($role !== null && $role !== '') {
            $roleFiltre = RoleAcces::tryFrom($role);
            if ($roleFiltre === null || !in_array($roleFiltre, self::ROLES_SR, true)) {
                throw new DonneesInvalidesException('Le role doit etre AGENT_SR ou CHEF_SR.');
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
            self::ROLES_SR,
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

    public function detail(int $id): array
    {
        return $this->trouverUtilisateurSr($id)->jsonSerialize();
    }

    public function creer(array $data): array
    {
        $matricule = trim((string) ($data['matricule'] ?? ''));
        $email = trim((string) ($data['email'] ?? ''));
        $nom = trim((string) ($data['nom'] ?? ''));
        $prenom = trim((string) ($data['prenom'] ?? ''));
        $roles = $this->resoudreRoles($data['roles'] ?? $data['role'] ?? null);
        $motDePasseFourni = trim((string) ($data['mot_de_passe'] ?? ''));

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
        $utilisateur->setRolesAcces($roles);
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

    public function modifier(int $id, array $data): array
    {
        $utilisateur = $this->trouverUtilisateurSr($id);

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

        if (array_key_exists('roles', $data) || array_key_exists('role', $data)) {
            $utilisateur->setRolesAcces($this->resoudreRoles($data['roles'] ?? $data['role']));
        }

        $this->utilisateurRepository->flush();

        return $utilisateur->jsonSerialize();
    }

    public function desactiver(int $id): void
    {
        $utilisateur = $this->trouverUtilisateurSr($id);
        $utilisateur->setActif(false);
        $this->utilisateurRepository->flush();
    }

    public function reactiver(int $id): void
    {
        $utilisateur = $this->trouverUtilisateurSr($id);
        $utilisateur->setActif(true);
        $this->utilisateurRepository->flush();
    }

    public function supprimer(int $id, Utilisateur $utilisateurConnecte): void
    {
        $utilisateur = $this->trouverUtilisateurSr($id);

        if ($utilisateur->getId() === $utilisateurConnecte->getId()) {
            throw new ActionInterditeException('Vous ne pouvez pas supprimer votre propre compte.');
        }

        $aDeLActivite = $this->ficheDepotRepository->countByUtilisateur($id) > 0
            || $this->historiqueFicheRepository->countByUtilisateur($id) > 0;

        if ($aDeLActivite) {
            throw new UtilisateurAvecActiviteException(
                'Cet utilisateur a des fiches ou un historique associes et ne peut pas etre supprime definitivement. Desactivez-le a la place.',
            );
        }

        $this->utilisateurRepository->remove($utilisateur, true);
    }

    public function reinitialiserMotDePasse(int $id): array
    {
        $utilisateur = $this->trouverUtilisateurSr($id);

        $motDePasseTemporaire = $this->genererMotDePasseTemporaire();
        $utilisateur->setMotDePasseHash($this->passwordHasher->hashPassword($utilisateur, $motDePasseTemporaire));
        $utilisateur->setConnection('first');
        $this->utilisateurRepository->flush();

        return ['mot_de_passe_temporaire' => $motDePasseTemporaire];
    }

    private function trouverUtilisateurSr(int $id): Utilisateur
    {
        $utilisateur = $this->utilisateurRepository->find($id);
        $appartientAuSr = $utilisateur !== null
            && array_any(self::ROLES_SR, static fn (RoleAcces $r): bool => $utilisateur->hasRoleAcces($r));

        if (!$appartientAuSr) {
            throw new UtilisateurIntrouvableException('Utilisateur introuvable.');
        }

        return $utilisateur;
    }

    private function resoudreRoles(mixed $roles): array
    {
        if ($roles === null || $roles === '') {
            return [RoleAcces::AGENT_SR];
        }

        $valeurs = is_array($roles) ? $roles : [$roles];
        $resolus = [];
        foreach ($valeurs as $valeur) {
            $resolved = is_string($valeur) ? RoleAcces::tryFrom($valeur) : null;
            if ($resolved === null || !in_array($resolved, self::ROLES_SR, true)) {
                throw new DonneesInvalidesException('Le role doit etre AGENT_SR ou CHEF_SR.');
            }
            if (!in_array($resolved, $resolus, true)) {
                $resolus[] = $resolved;
            }
        }

        if ($resolus === []) {
            throw new DonneesInvalidesException('Au moins un role est requis (AGENT_SR ou CHEF_SR).');
        }

        return $resolus;
    }

    private function genererMotDePasseTemporaire(): string
    {
        return bin2hex(random_bytes(5));
    }
}
