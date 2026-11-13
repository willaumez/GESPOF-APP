<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Repository;

use App\Module\ServiceOperationsFinancieres\Entite\Import\DcMandat;
use App\Module\ServiceOperationsFinancieres\Enum\TypeDcMandat;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<DcMandat>
 */
class DcMandatRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, DcMandat::class);
    }

    /**
     * @return list<DcMandat>
     */
    public function listerParLot(int $lotId, ?int $limite = null, int $offset = 0): array
    {
        $qb = $this->createQueryBuilder('d')
            ->andWhere('d.lot = :lot')
            ->setParameter('lot', $lotId)
            ->orderBy('d.datRegl', 'ASC')
            ->addOrderBy('d.nEmis', 'ASC')
            ->addOrderBy('d.id', 'ASC');

        if ($offset > 0) {
            $qb->setFirstResult($offset);
        }
        if ($limite !== null && $limite > 0) {
            $qb->setMaxResults($limite);
        }

        /** @var list<DcMandat> $rows */
        $rows = $qb->getQuery()->getResult();

        return $rows;
    }

    public function compterParLot(int $lotId): int
    {
        return (int) $this->createQueryBuilder('d')
            ->select('COUNT(d.id)')
            ->andWhere('d.lot = :lot')
            ->setParameter('lot', $lotId)
            ->getQuery()
            ->getSingleScalarResult();
    }

    public function supprimerParLot(int $lotId): void
    {
        $this->createQueryBuilder('d')
            ->delete()
            ->andWhere('d.lot = :lot')
            ->setParameter('lot', $lotId)
            ->getQuery()
            ->execute();
    }

    /**
     * @return list<DcMandat>
     */
    public function listerParLotEtType(int $lotId, TypeDcMandat $type): array
    {
        /** @var list<DcMandat> $rows */
        $rows = $this->createQueryBuilder('d')
            ->andWhere('d.lot = :lot')
            ->andWhere('d.type = :type')
            ->setParameter('lot', $lotId)
            ->setParameter('type', $type)
            ->orderBy('d.datRegl', 'ASC')
            ->addOrderBy('d.nEmis', 'ASC')
            ->getQuery()
            ->getResult();

        return $rows;
    }
}
