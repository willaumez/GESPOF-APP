<?php

declare(strict_types=1);

namespace App\Shared\Repository;

use App\Shared\Entite\SessionConnexion;
use App\Shared\Enum\MotifDeconnexion;
use App\Shared\Enum\Portail;
use App\Shared\Enum\RoleAcces;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

class SessionConnexionRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, SessionConnexion::class);
    }

    public function save(SessionConnexion $session, bool $flush = false): void
    {
        $this->getEntityManager()->persist($session);
        if ($flush) {
            $this->getEntityManager()->flush();
        }
    }

    public function flush(): void
    {
        $this->getEntityManager()->flush();
    }

    public function findByUuid(string $uuid): ?SessionConnexion
    {
        return $this->findOneBy(['uuid' => $uuid]);
    }

    public function findDerniereOuverteParUtilisateur(int $utilisateurId): ?SessionConnexion
    {
        return $this->createQueryBuilder('s')
            ->andWhere('IDENTITY(s.utilisateur) = :id')
            ->andWhere('s.dateDeconnexion IS NULL')
            ->setParameter('id', $utilisateurId)
            ->orderBy('s.dateConnexion', 'DESC')
            ->setMaxResults(1)
            ->getQuery()
            ->getOneOrNullResult();
    }

    /**
     * Ferme les sessions dont le jeton est expiré et qui n'ont pas été
     * clôturées explicitement (fermeture paresseuse).
     */
    public function cloturerExpirees(\DateTimeImmutable $maintenant): int
    {
        return (int) $this->getEntityManager()->createQueryBuilder()
            ->update(SessionConnexion::class, 's')
            ->set('s.dateDeconnexion', ':now')
            ->set('s.motifDeconnexion', ':motif')
            ->where('s.dateDeconnexion IS NULL')
            ->andWhere('s.dateExpirationJeton <= :now')
            ->setParameter('now', $maintenant)
            ->setParameter('motif', MotifDeconnexion::EXPIRATION->value)
            ->getQuery()
            ->execute();
    }

    /**
     * @param Portail[]|null $portails  null = tous les portails
     *
     * @return array{sessions: SessionConnexion[], total: int}
     */
    public function listerPagine(
        ?array $portails,
        string $search,
        ?string $statut,
        ?\DateTimeImmutable $dateDebut,
        ?\DateTimeImmutable $dateFinExclusive,
        ?int $utilisateurId,
        int $page,
        int $limit,
        bool $toutAfficher,
    ): array {
        $qb = $this->createQueryBuilder('s')
            ->leftJoin('s.utilisateur', 'u')->addSelect('u');

        if ($portails !== null) {
            if ($portails === []) {
                return ['sessions' => [], 'total' => 0];
            }
            $qb->andWhere('s.portail IN (:portails)')
                ->setParameter('portails', array_map(
                    static fn (Portail $p): string => $p->value,
                    $portails,
                ));
        }

        $search = trim($search);
        if ($search !== '') {
            $qb->andWhere(
                'LOWER(s.nom) LIKE :search OR LOWER(s.prenom) LIKE :search'
                . ' OR LOWER(s.email) LIKE :search OR LOWER(s.matricule) LIKE :search',
            )->setParameter('search', '%' . mb_strtolower($search) . '%');
        }

        if ($statut === 'en_ligne') {
            $qb->andWhere('s.dateDeconnexion IS NULL');
        } elseif ($statut === 'deconnecte') {
            $qb->andWhere('s.dateDeconnexion IS NOT NULL');
        }

        if ($dateDebut !== null) {
            $qb->andWhere('s.dateConnexion >= :dateDebut')->setParameter('dateDebut', $dateDebut);
        }

        if ($dateFinExclusive !== null) {
            $qb->andWhere('s.dateConnexion < :dateFin')->setParameter('dateFin', $dateFinExclusive);
        }

        if ($utilisateurId !== null) {
            $qb->andWhere('IDENTITY(s.utilisateur) = :utilisateurId')
                ->setParameter('utilisateurId', $utilisateurId);
        }

        $total = (int) (clone $qb)->select('COUNT(s.id)')->getQuery()->getSingleScalarResult();

        $qb->orderBy('s.dateConnexion', 'DESC');

        if (!$toutAfficher) {
            $qb->setFirstResult(($page - 1) * $limit)->setMaxResults($limit);
        }

        return [
            'sessions' => $qb->getQuery()->getResult(),
            'total' => $total,
        ];
    }

    /**
     * Série quotidienne (connexions / déconnexions) pour le graphique.
     *
     * @param Portail[]|null $portails
     *
     * @return list<array{date: string, connexions: int, deconnexions: int}>
     */
    public function serieQuotidienne(
        ?array $portails,
        \DateTimeImmutable $debut,
        \DateTimeImmutable $finExclusive,
    ): array {
        $jours = [];
        for ($jour = $debut; $jour < $finExclusive; $jour = $jour->modify('+1 day')) {
            $cle = $jour->format('Y-m-d');
            $jours[$cle] = [
                'date' => $cle,
                'connexions' => 0,
                'deconnexions' => 0,
            ];
        }

        if ($portails !== null && $portails === []) {
            return array_values($jours);
        }

        $portailValues = $portails === null
            ? null
            : array_map(static fn (Portail $p): string => $p->value, $portails);

        $qbConnexions = $this->createQueryBuilder('s')
            ->select('s.dateConnexion')
            ->andWhere('s.dateConnexion >= :debut')
            ->andWhere('s.dateConnexion < :fin')
            ->setParameter('debut', $debut)
            ->setParameter('fin', $finExclusive);
        $this->appliquerFiltrePortails($qbConnexions, $portailValues);

        foreach ($qbConnexions->getQuery()->getArrayResult() as $ligne) {
            $date = $ligne['dateConnexion'] ?? null;
            if (!$date instanceof \DateTimeInterface) {
                continue;
            }
            $cle = $date->format('Y-m-d');
            if (isset($jours[$cle])) {
                ++$jours[$cle]['connexions'];
            }
        }

        $qbDeconnexions = $this->createQueryBuilder('s')
            ->select('s.dateDeconnexion')
            ->andWhere('s.dateDeconnexion IS NOT NULL')
            ->andWhere('s.dateDeconnexion >= :debut')
            ->andWhere('s.dateDeconnexion < :fin')
            ->setParameter('debut', $debut)
            ->setParameter('fin', $finExclusive);
        $this->appliquerFiltrePortails($qbDeconnexions, $portailValues);

        foreach ($qbDeconnexions->getQuery()->getArrayResult() as $ligne) {
            $date = $ligne['dateDeconnexion'] ?? null;
            if (!$date instanceof \DateTimeInterface) {
                continue;
            }
            $cle = $date->format('Y-m-d');
            if (isset($jours[$cle])) {
                ++$jours[$cle]['deconnexions'];
            }
        }

        return array_values($jours);
    }

    /**
     * Nombre de connexions par utilisateur sur 7 / 30 / 90 jours.
     *
     * @param Portail[]|null $portails
     *
     * @return list<array{
     *   matricule: string,
     *   nom: string,
     *   prenom: string,
     *   nom_complet: string,
     *   email: string,
     *   connexions_7j: int,
     *   connexions_30j: int,
     *   connexions_90j: int,
     *   en_ligne: bool
     * }>
     */
    public function connexionsParUtilisateur(
        ?array $portails,
        \DateTimeImmutable $debut90,
        \DateTimeImmutable $finExclusive,
    ): array {
        if ($portails !== null && $portails === []) {
            return [];
        }

        $portailValues = $portails === null
            ? null
            : array_map(static fn (Portail $p): string => $p->value, $portails);

        $qb = $this->createQueryBuilder('s')
            ->select(
                's.matricule',
                's.nom',
                's.prenom',
                's.email',
                's.dateConnexion',
                's.dateDeconnexion',
                'IDENTITY(s.utilisateur) AS utilisateur_id',
                'u.photoChemin AS photo_chemin',
            )
            ->leftJoin('s.utilisateur', 'u')
            ->andWhere('s.dateConnexion >= :debut')
            ->andWhere('s.dateConnexion < :fin')
            ->setParameter('debut', $debut90)
            ->setParameter('fin', $finExclusive);
        $this->appliquerFiltrePortails($qb, $portailValues);

        $dernierJour = $finExclusive->modify('-1 day')->setTime(0, 0, 0);
        $debut7 = $dernierJour->modify('-6 days');
        $debut30 = $dernierJour->modify('-29 days');

        $parUtilisateur = [];
        foreach ($qb->getQuery()->getArrayResult() as $ligne) {
            $matricule = (string) ($ligne['matricule'] ?? '');
            $email = (string) ($ligne['email'] ?? '');
            $cle = $matricule !== '' ? $matricule : mb_strtolower($email);
            if ($cle === '') {
                continue;
            }

            if (!isset($parUtilisateur[$cle])) {
                $prenom = (string) ($ligne['prenom'] ?? '');
                $nom = (string) ($ligne['nom'] ?? '');
                $utilisateurId = $ligne['utilisateur_id'] ?? null;
                $photoChemin = $ligne['photo_chemin'] ?? null;
                $parUtilisateur[$cle] = [
                    'id' => $utilisateurId !== null ? (int) $utilisateurId : null,
                    'matricule' => $matricule,
                    'nom' => $nom,
                    'prenom' => $prenom,
                    'nom_complet' => trim($prenom . ' ' . $nom),
                    'email' => $email,
                    'a_photo' => is_string($photoChemin) && $photoChemin !== '',
                    'connexions_7j' => 0,
                    'connexions_30j' => 0,
                    'connexions_90j' => 0,
                    'en_ligne' => false,
                ];
            }

            $date = $ligne['dateConnexion'] ?? null;
            if ($date instanceof \DateTimeInterface) {
                ++$parUtilisateur[$cle]['connexions_90j'];
                if ($date >= $debut30) {
                    ++$parUtilisateur[$cle]['connexions_30j'];
                }
                if ($date >= $debut7) {
                    ++$parUtilisateur[$cle]['connexions_7j'];
                }
            }

            if (($ligne['dateDeconnexion'] ?? null) === null) {
                $parUtilisateur[$cle]['en_ligne'] = true;
            }
        }

        $liste = array_values($parUtilisateur);
        usort(
            $liste,
            static fn (array $a, array $b): int => $b['connexions_90j'] <=> $a['connexions_90j'],
        );

        return $liste;
    }

    /**
     * Répartitions pour les graphiques (7 / 30 / 90 jours).
     *
     * @param Portail[]|null $portails
     *
     * @return array{
     *   par_service: list<array{cle: string, libelle: string, n_7j: int, n_30j: int, n_90j: int}>,
     *   par_metier: list<array{cle: string, libelle: string, n_7j: int, n_30j: int, n_90j: int}>,
     *   par_motif: list<array{cle: string, libelle: string, n_7j: int, n_30j: int, n_90j: int}>,
     *   par_jour_semaine: list<array{cle: string, libelle: string, n_7j: int, n_30j: int, n_90j: int}>
     * }
     */
    public function repartitionsGraphiques(
        ?array $portails,
        \DateTimeImmutable $debut90,
        \DateTimeImmutable $finExclusive,
    ): array {
        $services = [
            'SP' => $this->partieVide('SP', 'SP'),
            'SR' => $this->partieVide('SR', 'SR'),
            'SOF' => $this->partieVide('SOF', 'SOF'),
            'ADMIN' => $this->partieVide('ADMIN', 'Admin'),
        ];
        $metiers = [
            'agent' => $this->partieVide('agent', 'Agent'),
            'chef' => $this->partieVide('chef', 'Chef'),
            'administrateur' => $this->partieVide('administrateur', 'Administrateur'),
            'direction' => $this->partieVide('direction', 'Direction'),
        ];
        $motifs = [
            MotifDeconnexion::DECONNEXION->value => $this->partieVide(
                MotifDeconnexion::DECONNEXION->value,
                MotifDeconnexion::DECONNEXION->libelle(),
            ),
            MotifDeconnexion::INACTIVITE->value => $this->partieVide(
                MotifDeconnexion::INACTIVITE->value,
                MotifDeconnexion::INACTIVITE->libelle(),
            ),
            MotifDeconnexion::EXPIRATION->value => $this->partieVide(
                MotifDeconnexion::EXPIRATION->value,
                MotifDeconnexion::EXPIRATION->libelle(),
            ),
            MotifDeconnexion::NOUVELLE_CONNEXION->value => $this->partieVide(
                MotifDeconnexion::NOUVELLE_CONNEXION->value,
                'Autre appareil / navigateur',
            ),
        ];
        $joursSemaine = [
            '1' => $this->partieVide('1', 'Lundi'),
            '2' => $this->partieVide('2', 'Mardi'),
            '3' => $this->partieVide('3', 'Mercredi'),
            '4' => $this->partieVide('4', 'Jeudi'),
            '5' => $this->partieVide('5', 'Vendredi'),
            '6' => $this->partieVide('6', 'Samedi'),
            '7' => $this->partieVide('7', 'Dimanche'),
        ];

        if ($portails !== null && $portails === []) {
            return [
                'par_service' => array_values($services),
                'par_metier' => array_values($metiers),
                'par_motif' => array_values($motifs),
                'par_jour_semaine' => array_values($joursSemaine),
            ];
        }

        $portailValues = $portails === null
            ? null
            : array_map(static fn (Portail $p): string => $p->value, $portails);

        $qb = $this->createQueryBuilder('s')
            ->select('s.portail', 's.role', 's.motifDeconnexion', 's.dateConnexion', 's.dateDeconnexion')
            ->andWhere('s.dateConnexion >= :debut')
            ->andWhere('s.dateConnexion < :fin')
            ->setParameter('debut', $debut90)
            ->setParameter('fin', $finExclusive);
        $this->appliquerFiltrePortails($qb, $portailValues);

        $dernierJour = $finExclusive->modify('-1 day')->setTime(0, 0, 0);
        $debut7 = $dernierJour->modify('-6 days');
        $debut30 = $dernierJour->modify('-29 days');

        foreach ($qb->getQuery()->getArrayResult() as $ligne) {
            $date = $ligne['dateConnexion'] ?? null;
            if (!$date instanceof \DateTimeInterface) {
                continue;
            }

            $portail = strtoupper((string) ($ligne['portail'] ?? ''));
            if ($portail === '' || !isset($services[$portail])) {
                $portail = 'ADMIN';
            }
            $this->incrementerPartie($services[$portail], $date, $debut7, $debut30);

            $groupe = self::groupeMetier((string) ($ligne['role'] ?? ''));
            if (!isset($metiers[$groupe['cle']])) {
                $metiers[$groupe['cle']] = $this->partieVide($groupe['cle'], $groupe['libelle']);
            }
            $this->incrementerPartie($metiers[$groupe['cle']], $date, $debut7, $debut30);

            $isoJour = $date->format('N');
            if (isset($joursSemaine[$isoJour])) {
                $this->incrementerPartie($joursSemaine[$isoJour], $date, $debut7, $debut30);
            }

            if (($ligne['dateDeconnexion'] ?? null) === null) {
                continue;
            }
            $motif = (string) ($ligne['motifDeconnexion'] ?? MotifDeconnexion::DECONNEXION->value);
            if (!isset($motifs[$motif])) {
                $motif = MotifDeconnexion::DECONNEXION->value;
            }
            $this->incrementerPartie($motifs[$motif], $date, $debut7, $debut30);
        }

        return [
            'par_service' => array_values($services),
            'par_metier' => array_values($metiers),
            'par_motif' => array_values($motifs),
            'par_jour_semaine' => array_values($joursSemaine),
        ];
    }

    /**
     * @return array{cle: string, libelle: string, n_7j: int, n_30j: int, n_90j: int}
     */
    private function partieVide(string $cle, string $libelle): array
    {
        return [
            'cle' => $cle,
            'libelle' => $libelle,
            'n_7j' => 0,
            'n_30j' => 0,
            'n_90j' => 0,
        ];
    }

    /**
     * @param array{cle: string, libelle: string, n_7j: int, n_30j: int, n_90j: int} $partie
     */
    private function incrementerPartie(
        array &$partie,
        \DateTimeInterface $date,
        \DateTimeImmutable $debut7,
        \DateTimeImmutable $debut30,
    ): void {
        ++$partie['n_90j'];
        if ($date >= $debut30) {
            ++$partie['n_30j'];
        }
        if ($date >= $debut7) {
            ++$partie['n_7j'];
        }
    }

    /**
     * @return array{cle: string, libelle: string}
     */
    private static function groupeMetier(string $role): array
    {
        $enum = RoleAcces::tryFrom($role);

        return match ($enum) {
            RoleAcces::AGENT_SP, RoleAcces::AGENT_SR, RoleAcces::AGENT_SOF => [
                'cle' => 'agent',
                'libelle' => 'Agent',
            ],
            RoleAcces::CHEF_SP, RoleAcces::CHEF_SR, RoleAcces::CHEF_SOF => [
                'cle' => 'chef',
                'libelle' => 'Chef',
            ],
            RoleAcces::ADMINISTRATEUR => [
                'cle' => 'administrateur',
                'libelle' => 'Administrateur',
            ],
            RoleAcces::DIRECTEUR_DOMF, RoleAcces::DIRECTION_DG, RoleAcces::SUPERVISEUR => [
                'cle' => 'direction',
                'libelle' => 'Direction',
            ],
            default => [
                'cle' => 'autre',
                'libelle' => 'Autre',
            ],
        };
    }

    /**
     * @param Portail[]|null $portails
     *
     * @return array{utilisateurs_connectes: int, sessions_actives: int, connexions_aujourdhui: int}
     */
    public function resume(?array $portails, \DateTimeImmutable $debutJour): array
    {
        $portailValues = $portails === null
            ? null
            : array_map(static fn (Portail $p): string => $p->value, $portails);

        if ($portails !== null && $portails === []) {
            return [
                'utilisateurs_connectes' => 0,
                'sessions_actives' => 0,
                'connexions_aujourdhui' => 0,
            ];
        }

        $qbActives = $this->createQueryBuilder('s')
            ->andWhere('s.dateDeconnexion IS NULL');
        $this->appliquerFiltrePortails($qbActives, $portailValues);

        $sessionsActives = (int) (clone $qbActives)
            ->select('COUNT(s.id)')
            ->getQuery()
            ->getSingleScalarResult();

        $utilisateursConnectes = (int) (clone $qbActives)
            ->select('COUNT(DISTINCT s.matricule)')
            ->getQuery()
            ->getSingleScalarResult();

        $qbAujourdhui = $this->createQueryBuilder('s')
            ->select('COUNT(s.id)')
            ->andWhere('s.dateConnexion >= :debutJour')
            ->setParameter('debutJour', $debutJour);
        $this->appliquerFiltrePortails($qbAujourdhui, $portailValues);

        return [
            'utilisateurs_connectes' => $utilisateursConnectes,
            'sessions_actives' => $sessionsActives,
            'connexions_aujourdhui' => (int) $qbAujourdhui->getQuery()->getSingleScalarResult(),
        ];
    }

    /**
     * @param Portail[]|null $portails
     *
     * @return SessionConnexion[]
     */
    public function listerActives(?array $portails, int $limite = 50): array
    {
        if ($portails !== null && $portails === []) {
            return [];
        }

        $qb = $this->createQueryBuilder('s')
            ->leftJoin('s.utilisateur', 'u')->addSelect('u')
            ->andWhere('s.dateDeconnexion IS NULL')
            ->orderBy('s.dateConnexion', 'DESC')
            ->setMaxResults($limite);

        $this->appliquerFiltrePortails(
            $qb,
            $portails === null ? null : array_map(static fn (Portail $p): string => $p->value, $portails),
        );

        return $qb->getQuery()->getResult();
    }

    /**
     * Ferme toutes les sessions encore ouvertes d'un utilisateur
     * (une seule session active à la fois).
     */
    public function cloturerOuvertesParUtilisateur(
        int $utilisateurId,
        MotifDeconnexion $motif,
        \DateTimeImmutable $instant,
    ): int {
        return (int) $this->getEntityManager()->createQueryBuilder()
            ->update(SessionConnexion::class, 's')
            ->set('s.dateDeconnexion', ':now')
            ->set('s.motifDeconnexion', ':motif')
            ->where('IDENTITY(s.utilisateur) = :id')
            ->andWhere('s.dateDeconnexion IS NULL')
            ->setParameter('now', $instant)
            ->setParameter('motif', $motif->value)
            ->setParameter('id', $utilisateurId)
            ->getQuery()
            ->execute();
    }

    /**
     * @param \Doctrine\ORM\QueryBuilder $qb
     * @param string[]|null             $portailValues
     */
    private function appliquerFiltrePortails($qb, ?array $portailValues): void
    {
        if ($portailValues !== null) {
            $qb->andWhere('s.portail IN (:portails)')->setParameter('portails', $portailValues);
        }
    }
}
