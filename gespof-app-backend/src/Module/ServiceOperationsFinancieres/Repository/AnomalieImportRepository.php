<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Repository;

use App\Module\ServiceOperationsFinancieres\Entite\Import\AnomalieImport;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<AnomalieImport>
 */
class AnomalieImportRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, AnomalieImport::class);
    }

    /**
     * @return list<AnomalieImport>
     */
    public function listerParLot(int $lotId): array
    {
        /** @var list<AnomalieImport> $anomalies */
        $anomalies = $this->createQueryBuilder('a')
            ->andWhere('a.lot = :lotId')
            ->setParameter('lotId', $lotId)
            ->orderBy('a.ligne', 'ASC')
            ->addOrderBy('a.id', 'ASC')
            ->getQuery()
            ->getResult();

        return $anomalies;
    }
}
