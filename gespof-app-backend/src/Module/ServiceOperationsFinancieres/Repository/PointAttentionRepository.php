<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Repository;

use App\Module\ServiceOperationsFinancieres\Entite\PointAttention;
use App\Module\ServiceOperationsFinancieres\Enum\PointAttentionCode;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<PointAttention>
 */
class PointAttentionRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, PointAttention::class);
    }

    /**
     * @return list<PointAttention>
     */
    public function listerParPeriode(int $periodeId): array
    {
        /** @var list<PointAttention> $rows */
        $rows = $this->createQueryBuilder('p')
            ->andWhere('p.periode = :pid')
            ->setParameter('pid', $periodeId)
            ->getQuery()
            ->getResult();

        return $rows;
    }

    public function trouver(int $periodeId, PointAttentionCode $code): ?PointAttention
    {
        /** @var PointAttention|null $row */
        $row = $this->createQueryBuilder('p')
            ->andWhere('p.periode = :pid')
            ->andWhere('p.code = :code')
            ->setParameter('pid', $periodeId)
            ->setParameter('code', $code)
            ->getQuery()
            ->getOneOrNullResult();

        return $row;
    }
}
