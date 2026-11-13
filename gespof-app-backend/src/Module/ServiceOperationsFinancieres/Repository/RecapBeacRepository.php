<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Repository;

use App\Module\ServiceOperationsFinancieres\Entite\Import\RecapBeac;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<RecapBeac>
 */
class RecapBeacRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, RecapBeac::class);
    }

    /**
     * @return list<RecapBeac>
     */
    public function listerParLot(int $lotId): array
    {
        /** @var list<RecapBeac> $lignes */
        $lignes = $this->createQueryBuilder('r')
            ->andWhere('r.lot = :lotId')
            ->setParameter('lotId', $lotId)
            ->orderBy('r.code', 'ASC')
            ->addOrderBy('r.id', 'ASC')
            ->getQuery()
            ->getResult();

        return $lignes;
    }
}
