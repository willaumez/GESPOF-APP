<?php

declare(strict_types=1);

namespace App\Shared\Service;

use App\Shared\Entite\AuditAction;
use App\Shared\Entite\Utilisateur;
use App\Shared\Enum\ActionAutorisee;
use App\Shared\Enum\Portail;
use App\Shared\Enum\RoleAcces;
use App\Shared\Exception\ActionInterditeException;
use App\Shared\Exception\DonneesInvalidesException;
use App\Shared\EventListener\JwtAuthenticationSuccessListener;
use App\Shared\Repository\AuditActionRepository;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;

class AuditActionService implements AuditActionServiceInterface
{
    private const MASQUE_SECRET = '************';

    /** @var string[] */
    private const CHAMPS_SENSIBLES = [
        'password',
        'mot_de_passe',
        'motDePasse',
        'mot_de_passe_hash',
        'nouveau_mot_de_passe',
        'ancien_mot_de_passe',
        'confirmation',
        'confirmation_mot_de_passe',
        'current_password',
        'new_password',
        'old_password',
        'token',
        'refresh_token',
        'access_token',
        'secret',
    ];

    private const METHODES_JOURNALISEES = ['POST', 'PUT', 'PATCH', 'DELETE'];

    public function __construct(
        private readonly AuditActionRepository $repository,
    ) {
    }

    public function enregistrerDepuisRequete(
        Request $request,
        Response $response,
        ?Utilisateur $utilisateur,
    ): void {
        if (!$this->doitJournaliser($request)) {
            return;
        }

        $chemin = $this->chemin($request);
        $methode = strtoupper($request->getMethod());
        $corps = $this->extraireCorps($request);
        $emailCorps = $this->emailDepuisCorps($corps);

        $entree = new AuditAction();
        $entree->setMethode($methode);
        $entree->setChemin(mb_substr($chemin, 0, 512));
        $entree->setAction($this->libelleAction($methode, $chemin));
        $entree->setModule($this->moduleDepuisChemin($chemin));
        $entree->setCorps($corps);
        $entree->setCodeHttp($response->getStatusCode());
        $entree->setAdresseIp($request->getClientIp());
        $userAgent = $request->headers->get('User-Agent');
        $entree->setUserAgent($userAgent !== null ? mb_substr($userAgent, 0, 512) : null);
        $sid = $request->attributes->get(JwtAuthenticationSuccessListener::ATTR_SESSION_ID);
        $entree->setSessionUuid(\is_string($sid) && $sid !== '' ? $sid : null);

        if ($utilisateur instanceof Utilisateur) {
            $role = $utilisateur->getRolesAcces()[0] ?? null;
            $entree->setUtilisateur($utilisateur);
            $entree->setMatricule($utilisateur->getMatricule());
            $entree->setNom($utilisateur->getNom());
            $entree->setPrenom($utilisateur->getPrenom());
            $entree->setEmail($utilisateur->getEmail());
            $entree->setRole($role?->value ?? '');
            $entree->setPortail($role?->portail()?->value);
        } else {
            $entree->setEmail($emailCorps ?? '');
        }

        $this->repository->save($entree, true);
    }

    public function lister(
        Utilisateur $utilisateurConnecte,
        string $portee,
        string $search,
        ?string $dateDebut,
        ?string $dateFin,
        ?string $methode,
        ?int $codeHttp,
        ?int $utilisateurId,
        int $page,
        string $limitRaw,
        ?string $portail = null,
    ): array {
        $portee = strtolower(trim($portee));
        if (!in_array($portee, ['service', 'moi'], true)) {
            throw new DonneesInvalidesException('La portée doit être « service » ou « moi ».');
        }

        if ($portee === 'service') {
            $this->assertPeutConsulterService($utilisateurConnecte);
        }

        $filtre = $this->filtreVisibilite($utilisateurConnecte, $portee, $portail);

        $methodeNorm = $methode !== null ? strtoupper(trim($methode)) : null;
        if ($methodeNorm !== null && $methodeNorm !== '' && !in_array($methodeNorm, self::METHODES_JOURNALISEES, true)) {
            throw new DonneesInvalidesException('Méthode HTTP inconnue.');
        }
        if ($methodeNorm === '') {
            $methodeNorm = null;
        }

        $debut = $this->parseDate($dateDebut, 'date_debut');
        $finExclusive = $this->parseDate($dateFin, 'date_fin')?->modify('+1 day');

        $page = max(1, $page);
        $limitRaw = trim($limitRaw);
        $toutAfficher = $limitRaw === 'all';
        $limit = $toutAfficher ? 0 : max(1, (int) $limitRaw);

        $uid = $portee === 'moi' ? $utilisateurConnecte->getId() : $utilisateurId;
        $emailActeur = $portee === 'moi' ? $utilisateurConnecte->getEmail() : null;

        $resultat = $this->repository->listerPagine(
            $filtre['modules_service'],
            $filtre['modules_partages'],
            $filtre['portail_acteur'],
            $search,
            $methodeNorm,
            $codeHttp,
            $debut,
            $finExclusive,
            $uid,
            $emailActeur,
            $page,
            $limit,
            $toutAfficher,
        );

        $total = $resultat['total'];
        $totalPages = $toutAfficher ? 1 : max(1, (int) ceil($total / max(1, $limit)));
        $page = $toutAfficher ? 1 : min($page, $totalPages);

        return [
            'actions' => array_map($this->serialiser(...), $resultat['actions']),
            'pagination' => [
                'page' => $page,
                'limit' => $toutAfficher ? $total : $limit,
                'total' => $total,
                'total_pages' => $totalPages,
            ],
        ];
    }

    private function doitJournaliser(Request $request): bool
    {
        if (!in_array(strtoupper($request->getMethod()), self::METHODES_JOURNALISEES, true)) {
            return false;
        }

        $chemin = $this->chemin($request);
        if (!str_starts_with($chemin, '/api/')) {
            return false;
        }

        if (str_contains($chemin, '/audit-actions')) {
            return false;
        }

        return true;
    }

    private function chemin(Request $request): string
    {
        return $request->getPathInfo() !== '' ? $request->getPathInfo() : $request->getRequestUri();
    }

    private function moduleDepuisChemin(string $chemin): string
    {
        if (preg_match('#^/api/v1/sp(?:/|$)#', $chemin) === 1) {
            return Portail::SP->value;
        }
        if (preg_match('#^/api/v1/sr(?:/|$)#', $chemin) === 1) {
            return Portail::SR->value;
        }
        if (preg_match('#^/api/v1/sof(?:/|$)#', $chemin) === 1) {
            return Portail::SOF->value;
        }
        if (preg_match('#^/api/v1/auth(?:/|$)#', $chemin) === 1) {
            return 'AUTH';
        }
        if (preg_match('#^/api/v1/(utilisateurs|audit-connexions)(?:/|$)#', $chemin) === 1) {
            return 'SHARED';
        }

        return Portail::ADMIN->value;
    }

    private function libelleAction(string $methode, string $chemin): string
    {
        return match (true) {
            str_ends_with($chemin, '/auth/login') => 'Connexion',
            str_ends_with($chemin, '/auth/logout') => 'Déconnexion',
            str_ends_with($chemin, '/auth/refresh') => 'Renouvellement de session',
            str_contains($chemin, '/auth/define-password') => 'Définition du mot de passe',
            str_contains($chemin, '/forgot-password') => 'Demande de réinitialisation du mot de passe',
            str_contains($chemin, '/auth/change-password') => 'Changement de mot de passe',
            str_contains($chemin, '/auth/verify-password') => 'Vérification du mot de passe',
            default => match ($methode) {
                'POST' => 'Création / envoi — ' . $this->ressource($chemin),
                'PUT', 'PATCH' => 'Modification — ' . $this->ressource($chemin),
                'DELETE' => 'Suppression — ' . $this->ressource($chemin),
                default => $methode . ' ' . $chemin,
            },
        };
    }

    private function ressource(string $chemin): string
    {
        $sansQuery = strtok($chemin, '?') ?: $chemin;
        $segments = array_values(array_filter(explode('/', $sansQuery), static fn (string $s): bool => $s !== ''));
        $utile = array_slice($segments, 2);

        return $utile === [] ? $sansQuery : '/' . implode('/', $utile);
    }

    /**
     * @return array<string, mixed>|null
     */
    private function extraireCorps(Request $request): ?array
    {
        $contentType = (string) $request->headers->get('Content-Type', '');
        $brut = [];

        if (str_contains($contentType, 'multipart/form-data')) {
            $brut = $request->request->all();
            foreach ($request->files->keys() as $cle) {
                $fichier = $request->files->get($cle);
                $brut[$cle] = $fichier ? '[fichier]' : null;
            }
        } else {
            $contenu = $request->getContent();
            if ($contenu !== '') {
                $decode = json_decode($contenu, true);
                $brut = \is_array($decode) ? $decode : ['_format' => 'non-json'];
            } elseif ($request->request->count() > 0) {
                $brut = $request->request->all();
            }
        }

        if ($brut === []) {
            return null;
        }

        $masque = $this->masquerSecrets($brut);
        $json = json_encode($masque, JSON_UNESCAPED_UNICODE);
        if (\is_string($json) && strlen($json) > 8000) {
            return ['_tronque' => true, '_apercu' => mb_substr($json, 0, 2000)];
        }

        return $masque;
    }

    /**
     * @param mixed $valeur
     *
     * @return mixed
     */
    private function masquerSecrets(mixed $valeur): mixed
    {
        if (!\is_array($valeur)) {
            return $valeur;
        }

        $sortie = [];
        foreach ($valeur as $cle => $item) {
            $nom = \is_string($cle) ? strtolower($cle) : (string) $cle;
            $sensible = false;
            foreach (self::CHAMPS_SENSIBLES as $champ) {
                if ($nom === strtolower($champ) || str_contains($nom, 'password') || str_contains($nom, 'mot_de_passe') || str_contains($nom, 'motdepasse')) {
                    $sensible = true;
                    break;
                }
            }
            $sortie[$cle] = $sensible ? self::MASQUE_SECRET : $this->masquerSecrets($item);
        }

        return $sortie;
    }

    /**
     * @param array<string, mixed>|null $corps
     */
    private function emailDepuisCorps(?array $corps): ?string
    {
        if ($corps === null) {
            return null;
        }
        foreach (['email', 'username', 'identifiant'] as $cle) {
            $valeur = $corps[$cle] ?? null;
            if (\is_string($valeur) && $valeur !== '') {
                return $valeur;
            }
        }

        return null;
    }

    /**
     * @return array{modules_service: string[]|null, modules_partages: string[], portail_acteur: string|null}
     */
    private function filtreVisibilite(Utilisateur $utilisateurConnecte, string $portee, ?string $portail): array
    {
        $portailPage = $this->portailDepuisFiltre($portail);
        $vide = ['modules_service' => null, 'modules_partages' => [], 'portail_acteur' => null];

        if ($portee === 'moi') {
            if ($portailPage === null) {
                return $vide;
            }

            return [
                'modules_service' => [$portailPage->value],
                'modules_partages' => ['AUTH', 'SHARED'],
                'portail_acteur' => $portailPage->value,
            ];
        }

        $geres = $this->portailsGeresPar($utilisateurConnecte);
        if ($geres !== null && $geres === []) {
            throw new ActionInterditeException(
                'Vous n\'avez pas les droits nécessaires pour consulter l\'audit d\'actions.',
            );
        }

        if ($portailPage === null) {
            return $vide;
        }

        if ($geres !== null && !in_array($portailPage, $geres, true)) {
            throw new ActionInterditeException(
                'Vous n\'avez pas les droits nécessaires pour consulter l\'audit d\'actions de ce service.',
            );
        }

        return [
            'modules_service' => [$portailPage->value],
            'modules_partages' => ['AUTH', 'SHARED'],
            'portail_acteur' => $portailPage->value,
        ];
    }

    private function portailDepuisFiltre(?string $portail): ?Portail
    {
        if ($portail === null || trim($portail) === '') {
            return null;
        }

        $enum = Portail::tryFrom(strtoupper(trim($portail)));
        if ($enum === null) {
            throw new DonneesInvalidesException('Portail inconnu.');
        }

        return $enum;
    }

    private function assertPeutConsulterService(Utilisateur $utilisateur): void
    {
        $geres = $this->portailsGeresPar($utilisateur);
        if ($geres !== null && $geres === []) {
            throw new ActionInterditeException(
                'Vous n\'avez pas les droits nécessaires pour consulter l\'audit d\'actions.',
            );
        }
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

    private function serialiser(AuditAction $a): array
    {
        $role = $a->getRoleAcces();
        $portail = $a->getPortailEnum();

        return [
            'id' => $a->getId(),
            'utilisateur' => [
                'id' => $a->getUtilisateur()?->getId(),
                'matricule' => $a->getMatricule(),
                'nom' => $a->getNom(),
                'prenom' => $a->getPrenom(),
                'nom_complet' => trim($a->getPrenom() . ' ' . $a->getNom()) ?: ($a->getEmail() !== '' ? $a->getEmail() : 'Inconnu'),
                'email' => $a->getEmail(),
            ],
            'role' => [
                'valeur' => $a->getRole(),
                'libelle' => $role?->libelle() ?? ($a->getRole() !== '' ? $a->getRole() : '—'),
            ],
            'portail' => $portail === null ? null : [
                'valeur' => $portail->value,
                'libelle' => $portail->libelle(),
            ],
            'module' => $a->getModule(),
            'methode' => $a->getMethode(),
            'chemin' => $a->getChemin(),
            'action' => $a->getAction(),
            'corps' => $a->getCorps(),
            'code_http' => $a->getCodeHttp(),
            'adresse_ip' => $a->getAdresseIp(),
            'date_action' => $a->getDateAction()->format('d/m/Y H:i:s'),
            'heure_action' => $a->getDateAction()->format('H:i:s'),
        ];
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
