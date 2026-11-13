<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Repository;

use App\Module\ServiceOperationsFinancieres\Entite\Audit\JournalAudit;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<JournalAudit>
 */
class JournalAuditRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, JournalAudit::class);
    }

    public function save(JournalAudit $entree, bool $flush = true): void
    {
        $this->getEntityManager()->persist($entree);
        if ($flush) {
            $this->getEntityManager()->flush();
        }
    }

    /**
     * @return array{entrees: list<JournalAudit>, total: int}
     */
    public function listerPagine(
        ?string $objetType,
        ?string $objetId,
        ?string $action,
        ?int $utilisateurId,
        int $page = 1,
        int $limit = 50,
    ): array {
        $page = max(1, $page);
        $limit = max(1, min(200, $limit));

        $qb = $this->createQueryBuilder('j')
            ->orderBy('j.horodatage', 'DESC')
            ->addOrderBy('j.id', 'DESC');

        if ($objetType !== null && $objetType !== '') {
            $qb->andWhere('j.objetType = :objetType')->setParameter('objetType', $objetType);
        }
        if ($objetId !== null && $objetId !== '') {
            $qb->andWhere('j.objetId = :objetId')->setParameter('objetId', $objetId);
        }
        if ($action !== null && $action !== '') {
            $qb->andWhere('j.action = :action')->setParameter('action', $action);
        }
        if ($utilisateurId !== null) {
            $qb->andWhere('IDENTITY(j.utilisateur) = :uid')->setParameter('uid', $utilisateurId);
        }

        $total = (int) (clone $qb)->select('COUNT(j.id)')->getQuery()->getSingleScalarResult();

        /** @var list<JournalAudit> $entrees */
        $entrees = $qb
            ->setFirstResult(($page - 1) * $limit)
            ->setMaxResults($limit)
            ->getQuery()
            ->getResult();

        return ['entrees' => $entrees, 'total' => $total];
    }
}
