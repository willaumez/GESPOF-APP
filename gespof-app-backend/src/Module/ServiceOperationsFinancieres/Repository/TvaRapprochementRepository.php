<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Repository;

use App\Module\ServiceOperationsFinancieres\Entite\Recette\TvaRapprochement;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<TvaRapprochement>
 */
class TvaRapprochementRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, TvaRapprochement::class);
    }

    /**
     * @return list<TvaRapprochement>
     */
    public function listerParPeriode(int $periodeId): array
    {
        /** @var list<TvaRapprochement> $rows */
        $rows = $this->createQueryBuilder('r')
            ->addSelect('d', 'o')
            ->innerJoin('r.dcMandat', 'd')
            ->leftJoin('r.igOperation', 'o')
            ->andWhere('r.periode = :pid')
            ->setParameter('pid', $periodeId)
            ->orderBy('d.datRegl', 'ASC')
            ->addOrderBy('d.nEmis', 'ASC')
            ->addOrderBy('r.id', 'ASC')
            ->getQuery()
            ->getResult();

        return $rows;
    }

    public function supprimerParPeriode(int $periodeId): void
    {
        $this->createQueryBuilder('r')
            ->delete()
            ->andWhere('r.periode = :pid')
            ->setParameter('pid', $periodeId)
            ->getQuery()
            ->execute();
    }
}
