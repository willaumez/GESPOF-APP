<?php

declare(strict_types=1);

namespace App\Shared\Repository;

use App\Shared\Entite\AuditAction;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

class AuditActionRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, AuditAction::class);
    }

    public function save(AuditAction $action, bool $flush = false): void
    {
        $this->getEntityManager()->persist($action);
        if ($flush) {
            $this->getEntityManager()->flush();
        }
    }

    /**
     * @param string[]|null $modulesService  endpoints du service (SP/SR/SOF)
     * @param string[]      $modulesPartages AUTH / SHARED, restreints au portail acteur
     *
     * @return array{actions: AuditAction[], total: int}
     */
    public function listerPagine(
        ?array $modulesService,
        array $modulesPartages,
        ?string $portailActeur,
        string $search,
        ?string $methode,
        ?int $codeHttp,
        ?\DateTimeImmutable $dateDebut,
        ?\DateTimeImmutable $dateFinExclusive,
        ?int $utilisateurId,
        ?string $emailActeur,
        int $page,
        int $limit,
        bool $toutAfficher,
    ): array {
        $qb = $this->createQueryBuilder('a');

        if ($modulesService !== null) {
            if ($modulesService === []) {
                return ['actions' => [], 'total' => 0];
            }
            if ($portailActeur !== null && $modulesPartages !== []) {
                $qb->andWhere(
                    'a.module IN (:modulesService) OR (a.module IN (:modulesPartages) AND a.portail = :portailActeur)',
                )
                    ->setParameter('modulesService', $modulesService)
                    ->setParameter('modulesPartages', $modulesPartages)
                    ->setParameter('portailActeur', $portailActeur);
            } else {
                $qb->andWhere('a.module IN (:modulesService)')
                    ->setParameter('modulesService', $modulesService);
            }
        }

        $search = trim($search);
        if ($search !== '') {
            $qb->andWhere(
                'LOWER(a.nom) LIKE :q OR LOWER(a.prenom) LIKE :q OR LOWER(a.email) LIKE :q
                OR LOWER(a.matricule) LIKE :q OR LOWER(a.chemin) LIKE :q
                OR LOWER(a.action) LIKE :q',
            )->setParameter('q', '%' . mb_strtolower($search) . '%');
        }

        if ($methode !== null && $methode !== '') {
            $qb->andWhere('a.methode = :methode')->setParameter('methode', $methode);
        }

        if ($codeHttp !== null) {
            $qb->andWhere('a.codeHttp = :code')->setParameter('code', $codeHttp);
        }

        if ($dateDebut !== null) {
            $qb->andWhere('a.dateAction >= :debut')->setParameter('debut', $dateDebut);
        }
        if ($dateFinExclusive !== null) {
            $qb->andWhere('a.dateAction < :fin')->setParameter('fin', $dateFinExclusive);
        }

        if ($utilisateurId !== null) {
            if ($emailActeur !== null && $emailActeur !== '') {
                $qb->andWhere('IDENTITY(a.utilisateur) = :uid OR LOWER(a.email) = :email')
                    ->setParameter('uid', $utilisateurId)
                    ->setParameter('email', mb_strtolower($emailActeur));
            } else {
                $qb->andWhere('IDENTITY(a.utilisateur) = :uid')->setParameter('uid', $utilisateurId);
            }
        }

        $total = (int) (clone $qb)->select('COUNT(a.id)')->getQuery()->getSingleScalarResult();

        $qb->orderBy('a.dateAction', 'DESC')->addOrderBy('a.id', 'DESC');

        if (!$toutAfficher) {
            $qb->setFirstResult(max(0, ($page - 1) * $limit))->setMaxResults($limit);
        }

        return [
            'actions' => $qb->getQuery()->getResult(),
            'total' => $total,
        ];
    }
}
