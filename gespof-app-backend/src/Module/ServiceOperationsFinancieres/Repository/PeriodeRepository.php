<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Repository;

use App\Module\ServiceOperationsFinancieres\Entite\Periode;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<Periode>
 */
class PeriodeRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, Periode::class);
    }

    /**
     * @return list<Periode>
     */
    public function listerParExercice(int $annee): array
    {
        /** @var list<Periode> $periodes */
        $periodes = $this->createQueryBuilder('p')
            ->andWhere('p.exercice = :annee')
            ->setParameter('annee', $annee)
            ->orderBy('p.mois', 'ASC')
            ->getQuery()
            ->getResult();

        return $periodes;
    }

    public function trouver(int $annee, int $mois): ?Periode
    {
        /** @var Periode|null $periode */
        $periode = $this->createQueryBuilder('p')
            ->andWhere('p.exercice = :annee')
            ->andWhere('p.mois = :mois')
            ->setParameter('annee', $annee)
            ->setParameter('mois', $mois)
            ->getQuery()
            ->getOneOrNullResult();

        return $periode;
    }
}
