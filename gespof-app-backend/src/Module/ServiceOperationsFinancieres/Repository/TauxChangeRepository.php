<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Repository;

use App\Module\ServiceOperationsFinancieres\Entite\Referentiel\TauxChange;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<TauxChange>
 */
class TauxChangeRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, TauxChange::class);
    }

    /**
     * @return list<TauxChange>
     */
    public function listerParExercice(int $annee): array
    {
        /** @var list<TauxChange> $rows */
        $rows = $this->createQueryBuilder('t')
            ->andWhere('t.exerciceAnnee = :annee')
            ->setParameter('annee', $annee)
            ->orderBy('t.mois', 'ASC')
            ->addOrderBy('t.devise', 'ASC')
            ->getQuery()
            ->getResult();

        return $rows;
    }

    public function trouver(int $annee, int $mois, string $devise): ?TauxChange
    {
        /** @var TauxChange|null $row */
        $row = $this->createQueryBuilder('t')
            ->andWhere('t.exerciceAnnee = :annee')
            ->andWhere('t.mois = :mois')
            ->andWhere('t.devise = :devise')
            ->setParameter('annee', $annee)
            ->setParameter('mois', $mois)
            ->setParameter('devise', strtoupper($devise))
            ->getQuery()
            ->getOneOrNullResult();

        return $row;
    }
}
