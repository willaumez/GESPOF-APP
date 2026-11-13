<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Repository;

use App\Module\ServiceOperationsFinancieres\Entite\Referentiel\OperationAjustement;
use App\Module\ServiceOperationsFinancieres\Enum\NatureAjustement;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<OperationAjustement>
 */
class OperationAjustementRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, OperationAjustement::class);
    }

    /**
     * @return list<OperationAjustement>
     */
    public function listerParPeriode(int $periodeId): array
    {
        /** @var list<OperationAjustement> $rows */
        $rows = $this->createQueryBuilder('a')
            ->andWhere('IDENTITY(a.periode) = :pid')
            ->setParameter('pid', $periodeId)
            ->orderBy('a.creeLe', 'DESC')
            ->getQuery()
            ->getResult();

        return $rows;
    }

    /**
     * @return list<OperationAjustement>
     */
    public function listerParExercice(int $exerciceAnnee, ?NatureAjustement $nature = null): array
    {
        $qb = $this->createQueryBuilder('a')
            ->innerJoin('a.periode', 'p')
            ->innerJoin('p.exercice', 'e')
            ->andWhere('e.annee = :annee')
            ->setParameter('annee', $exerciceAnnee)
            ->orderBy('p.mois', 'ASC')
            ->addOrderBy('a.id', 'ASC');

        if ($nature instanceof NatureAjustement) {
            $qb->andWhere('a.nature = :nature')->setParameter('nature', $nature);
        }

        /** @var list<OperationAjustement> $rows */
        $rows = $qb->getQuery()->getResult();

        return $rows;
    }
}
