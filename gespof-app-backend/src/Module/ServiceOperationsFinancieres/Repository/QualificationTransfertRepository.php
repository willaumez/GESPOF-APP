<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Repository;

use App\Module\ServiceOperationsFinancieres\Entite\Recette\QualificationTransfert;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<QualificationTransfert>
 */
class QualificationTransfertRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, QualificationTransfert::class);
    }

    public function trouverParOperation(int $igOperationId): ?QualificationTransfert
    {
        /** @var QualificationTransfert|null $q */
        $q = $this->createQueryBuilder('q')
            ->andWhere('IDENTITY(q.operation) = :id')
            ->setParameter('id', $igOperationId)
            ->getQuery()
            ->getOneOrNullResult();

        return $q;
    }

    /**
     * @param list<int> $ids
     *
     * @return array<int, QualificationTransfert>
     */
    public function indexerParOperations(array $ids): array
    {
        if ($ids === []) {
            return [];
        }

        /** @var list<QualificationTransfert> $rows */
        $rows = $this->createQueryBuilder('q')
            ->andWhere('IDENTITY(q.operation) IN (:ids)')
            ->setParameter('ids', $ids)
            ->getQuery()
            ->getResult();

        $out = [];
        foreach ($rows as $q) {
            $id = $q->getIgOperationId();
            if ($id !== null) {
                $out[$id] = $q;
            }
        }

        return $out;
    }
}
