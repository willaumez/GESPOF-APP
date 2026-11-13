<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Repository;

use App\Module\ServiceOperationsFinancieres\Entite\Import\CorrespondantMouvement;
use App\Module\ServiceOperationsFinancieres\Enum\SensMontantCompte;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<CorrespondantMouvement>
 */
class CorrespondantMouvementRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, CorrespondantMouvement::class);
    }

    /**
     * @return list<CorrespondantMouvement>
     */
    public function listerParLot(int $lotId): array
    {
        /** @var list<CorrespondantMouvement> $rows */
        $rows = $this->createQueryBuilder('m')
            ->andWhere('m.lot = :lot')
            ->setParameter('lot', $lotId)
            ->orderBy('m.categorie', 'ASC')
            ->addOrderBy('m.compte', 'ASC')
            ->addOrderBy('m.mois', 'ASC')
            ->addOrderBy('m.id', 'ASC')
            ->getQuery()
            ->getResult();

        return $rows;
    }

    public function compterParLot(int $lotId): int
    {
        return (int) $this->createQueryBuilder('m')
            ->select('COUNT(m.id)')
            ->andWhere('m.lot = :lot')
            ->setParameter('lot', $lotId)
            ->getQuery()
            ->getSingleScalarResult();
    }

    /**
     * @param list<int> $lotIds
     *
     * @return list<CorrespondantMouvement>
     */
    public function listerParLots(array $lotIds, ?SensMontantCompte $sens = null): array
    {
        if ($lotIds === []) {
            return [];
        }
        $qb = $this->createQueryBuilder('m')
            ->andWhere('m.lot IN (:lots)')
            ->setParameter('lots', $lotIds)
            ->orderBy('m.sens', 'ASC')
            ->addOrderBy('m.categorie', 'ASC')
            ->addOrderBy('m.compte', 'ASC')
            ->addOrderBy('m.mois', 'ASC');
        if ($sens !== null) {
            $qb->andWhere('m.sens = :sens')->setParameter('sens', $sens);
        }

        /** @var list<CorrespondantMouvement> $rows */
        $rows = $qb->getQuery()->getResult();

        return $rows;
    }
}
