<?php

declare(strict_types=1);

namespace App\Shared\Service;

use App\Shared\Entite\SessionConnexion;
use App\Shared\Entite\Utilisateur;
use App\Shared\Enum\ActionAutorisee;
use App\Shared\Enum\MotifDeconnexion;
use App\Shared\Enum\Portail;
use App\Shared\Enum\RoleAcces;
use App\Shared\Exception\ActionInterditeException;
use App\Shared\Exception\DonneesInvalidesException;
use App\Shared\Repository\SessionConnexionRepository;
use Symfony\Component\HttpFoundation\RequestStack;

class AuditConnexionService implements AuditConnexionServiceInterface
{
    public function __construct(
        private readonly SessionConnexionRepository $sessionRepository,
        private readonly RequestStack $requestStack,
    ) {
    }

    public function rattacherOuOuvrir(
        Utilisateur $utilisateur,
        ?string $uuid,
        \DateTimeImmutable $expirationJeton,
        bool $nouvelleSession,
    ): SessionConnexion {
        if (!$nouvelleSession && $uuid !== null && $uuid !== '') {
            $existante = $this->prolongerSession($uuid, $expirationJeton);
            if ($existante !== null) {
                return $existante;
            }
        }

        return $this->ouvrirSession($utilisateur, $expirationJeton);
    }

    public function sessionEstActive(string $uuid): bool
    {
        $session = $this->sessionRepository->findByUuid($uuid);

        return $session !== null && $session->estOuverte();
    }

    private function ouvrirSession(Utilisateur $utilisateur, \DateTimeImmutable $expirationJeton): SessionConnexion
    {
        $utilisateurId = $utilisateur->getId();
        if ($utilisateurId !== null) {
            $this->sessionRepository->cloturerOuvertesParUtilisateur(
                $utilisateurId,
                MotifDeconnexion::NOUVELLE_CONNEXION,
                new \DateTimeImmutable(),
            );
        }

        $role = $utilisateur->getRolesAcces()[0] ?? null;
        $requete = $this->requestStack->getCurrentRequest();
        $userAgent = $requete?->headers->get('User-Agent');

        $session = new SessionConnexion();
        $session->setUtilisateur($utilisateur);
        $session->setMatricule($utilisateur->getMatricule());
        $session->setNom($utilisateur->getNom());
        $session->setPrenom($utilisateur->getPrenom());
        $session->setEmail($utilisateur->getEmail());
        $session->setRole($role?->value ?? '');
        $session->setPortail($role?->portail()?->value);
        $session->setDateExpirationJeton($expirationJeton);
        $session->setAdresseIp($requete?->getClientIp());
        $session->setUserAgent($userAgent !== null ? mb_substr($userAgent, 0, 512) : null);

        $this->sessionRepository->save($session, true);

        return $session;
    }

    private function prolongerSession(string $uuid, \DateTimeImmutable $expirationJeton): ?SessionConnexion
    {
        $session = $this->sessionRepository->findByUuid($uuid);
        if ($session === null || !$session->estOuverte()) {
            return null;
        }

        $session->setDateExpirationJeton($expirationJeton);
        $this->sessionRepository->flush();

        return $session;
    }

    public function cloturerSession(?Utilisateur $utilisateur, ?string $uuid, MotifDeconnexion $motif): void
    {
        $session = null;
        if ($uuid !== null && $uuid !== '') {
            $session = $this->sessionRepository->findByUuid($uuid);
        }

        if ($session === null && $utilisateur !== null && $utilisateur->getId() !== null) {
            $session = $this->sessionRepository->findDerniereOuverteParUtilisateur($utilisateur->getId());
        }

        if ($session === null || !$session->estOuverte()) {
            return;
        }

        $session->cloturer(new \DateTimeImmutable(), $motif);
        $this->sessionRepository->flush();
    }

    public function lister(
        Utilisateur $utilisateurConnecte,
        string $search,
        ?string $statut,
        ?string $dateDebut,
        ?string $dateFin,
        ?int $utilisateurId,
        int $page,
        string $limitRaw,
        ?string $portail = null,
    ): array {
        $portails = $this->portailsVisibles($utilisateurConnecte, $portail);

        $statutNormalise = match ($statut) {
            'en_ligne', 'deconnecte' => $statut,
            default => null,
        };

        $debut = $this->parseDate($dateDebut, 'date_debut');
        $finExclusive = $this->parseDate($dateFin, 'date_fin')?->modify('+1 day');

        $page = max(1, $page);
        $limitRaw = trim($limitRaw);
        $toutAfficher = $limitRaw === 'all';
        $limit = $toutAfficher ? 0 : max(1, (int) $limitRaw);

        $maintenant = new \DateTimeImmutable();
        $this->sessionRepository->cloturerExpirees($maintenant);

        $resultat = $this->sessionRepository->listerPagine(
            $portails,
            $search,
            $statutNormalise,
            $debut,
            $finExclusive,
            $utilisateurId,
            $page,
            $limit,
            $toutAfficher,
        );

        $total = $resultat['total'];
        $totalPages = $toutAfficher ? 1 : max(1, (int) ceil($total / max(1, $limit)));
        $page = $toutAfficher ? 1 : min($page, $totalPages);

        $debutJour = $maintenant->setTime(0, 0, 0);
        $debutSerie = $debutJour->modify('-89 days');
        $finSerie = $debutJour->modify('+1 day');

        return [
            'sessions' => array_map(
                fn (SessionConnexion $s): array => $this->serialiser($s, $maintenant),
                $resultat['sessions'],
            ),
            'en_ligne' => array_map(
                fn (SessionConnexion $s): array => $this->serialiser($s, $maintenant),
                $this->sessionRepository->listerActives($portails),
            ),
            'resume' => $this->sessionRepository->resume($portails, $debutJour),
            'serie' => $this->sessionRepository->serieQuotidienne($portails, $debutSerie, $finSerie),
            'par_utilisateur' => $this->sessionRepository->connexionsParUtilisateur(
                $portails,
                $debutSerie,
                $finSerie,
            ),
            'repartitions' => $this->sessionRepository->repartitionsGraphiques(
                $portails,
                $debutSerie,
                $finSerie,
            ),
            'pagination' => [
                'page' => $page,
                'limit' => $toutAfficher ? $total : $limit,
                'total' => $total,
                'total_pages' => $totalPages,
            ],
        ];
    }

    /**
     * Portails consultables : ADMINISTRATEUR = tous (null) ; un chef = son
     * service. Le filtre `portail` (page SP/SR/SOF) restreint encore la liste
     * — y compris pour un administrateur qui ouvre la page d'un service.
     *
     * @return Portail[]|null
     */
    private function portailsVisibles(Utilisateur $utilisateurConnecte, ?string $portail): ?array
    {
        $geres = $this->portailsGeresPar($utilisateurConnecte);
        if ($geres !== null && $geres === []) {
            throw new ActionInterditeException(
                'Vous n\'avez pas les droits nécessaires pour consulter l\'audit des connexions.',
            );
        }

        if ($portail === null || trim($portail) === '') {
            return $geres;
        }

        $portailEnum = Portail::tryFrom(strtoupper(trim($portail)));
        if ($portailEnum === null) {
            throw new DonneesInvalidesException('Portail inconnu.');
        }

        if ($geres !== null && !in_array($portailEnum, $geres, true)) {
            return [];
        }

        return [$portailEnum];
    }

    /**
     * @return Portail[]|null  null = tous (administrateur)
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

    private function serialiser(SessionConnexion $s, \DateTimeImmutable $maintenant): array
    {
        $fin = $s->getDateDeconnexion() ?? $maintenant;
        $secondes = max(0, $fin->getTimestamp() - $s->getDateConnexion()->getTimestamp());
        $role = $s->getRoleAcces();
        $portail = $s->getPortailEnum();
        $motif = $s->getMotifDeconnexionEnum();
        $enLigne = $s->estOuverte();

        return [
            'id' => $s->getId(),
            'utilisateur' => [
                'id' => $s->getUtilisateur()?->getId(),
                'matricule' => $s->getMatricule(),
                'nom' => $s->getNom(),
                'prenom' => $s->getPrenom(),
                'nom_complet' => trim($s->getPrenom() . ' ' . $s->getNom()),
                'email' => $s->getEmail(),
                'a_photo' => (bool) $s->getUtilisateur()?->aUnePhoto(),
            ],
            'role' => [
                'valeur' => $s->getRole(),
                'libelle' => $role?->libelle() ?? $s->getRole(),
            ],
            'portail' => $portail === null ? null : [
                'valeur' => $portail->value,
                'libelle' => $portail->libelle(),
            ],
            'date_connexion' => $s->getDateConnexion()->format('d/m/Y H:i:s'),
            'heure_connexion' => $s->getDateConnexion()->format('H:i:s'),
            'date_deconnexion' => $s->getDateDeconnexion()?->format('d/m/Y H:i:s'),
            'heure_deconnexion' => $s->getDateDeconnexion()?->format('H:i:s'),
            'duree_secondes' => $secondes,
            'duree' => self::formaterDuree($secondes),
            'statut' => $enLigne ? 'EN_LIGNE' : 'DECONNECTE',
            'motif_deconnexion' => $motif === null ? null : [
                'valeur' => $motif->value,
                'libelle' => $motif->libelle(),
            ],
            'adresse_ip' => $s->getAdresseIp(),
            'user_agent' => $s->getUserAgent(),
        ];
    }

    private static function formaterDuree(int $secondes): string
    {
        $h = intdiv($secondes, 3600);
        $m = intdiv($secondes % 3600, 60);
        $s = $secondes % 60;

        if ($h > 0) {
            return sprintf('%d h %02d min %02d s', $h, $m, $s);
        }
        if ($m > 0) {
            return sprintf('%d min %02d s', $m, $s);
        }

        return sprintf('%d s', $s);
    }

    private function parseDate(?string $valeur, string $champ): ?\DateTimeImmutable
    {
        if ($valeur === null || trim($valeur) === '') {
            return null;
        }

        $date = \DateTimeImmutable::createFromFormat('Y-m-d', trim($valeur));
        if ($date === false) {
            throw new DonneesInvalidesException(sprintf('La %s est invalide.', $champ));
        }

        return $date->setTime(0, 0, 0);
    }
}
