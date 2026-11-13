<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Repository;

use App\Module\ServiceOperationsFinancieres\Entite\Import\IgOperation;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<IgOperation>
 */
class IgOperationRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, IgOperation::class);
    }

    /**
     * @return list<IgOperation>
     */
    public function listerParLot(int $lotId, int $limit = 5000): array
    {
        /** @var list<IgOperation> $lignes */
        $lignes = $this->createQueryBuilder('o')
            ->andWhere('o.lot = :lotId')
            ->setParameter('lotId', $lotId)
            ->orderBy('o.dCpta', 'ASC')
            ->addOrderBy('o.nRegl', 'ASC')
            ->addOrderBy('o.id', 'ASC')
            ->setMaxResults(max(1, $limit))
            ->getQuery()
            ->getResult();

        return $lignes;
    }

    public function compterParLot(int $lotId): int
    {
        return (int) $this->createQueryBuilder('o')
            ->select('COUNT(o.id)')
            ->andWhere('o.lot = :lotId')
            ->setParameter('lotId', $lotId)
            ->getQuery()
            ->getSingleScalarResult();
    }
}
