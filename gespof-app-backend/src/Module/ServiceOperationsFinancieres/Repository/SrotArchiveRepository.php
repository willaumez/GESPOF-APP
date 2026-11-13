<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Repository;

use App\Module\ServiceOperationsFinancieres\Entite\Referentiel\SrotArchive;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<SrotArchive>
 */
class SrotArchiveRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, SrotArchive::class);
    }

    /**
     * @return list<SrotArchive>
     */
    public function listerParExerciceMois(int $exerciceAnnee, int $mois): array
    {
        /** @var list<SrotArchive> $rows */
        $rows = $this->createQueryBuilder('a')
            ->andWhere('a.exerciceAnnee = :a')
            ->andWhere('a.mois = :m')
            ->setParameter('a', $exerciceAnnee)
            ->setParameter('m', $mois)
            ->orderBy('a.id', 'ASC')
            ->getQuery()
            ->getResult();

        return $rows;
    }

    public function supprimerParExerciceMois(int $exerciceAnnee, int $mois): int
    {
        return $this->createQueryBuilder('a')
            ->delete()
            ->andWhere('a.exerciceAnnee = :a')
            ->andWhere('a.mois = :m')
            ->setParameter('a', $exerciceAnnee)
            ->setParameter('m', $mois)
            ->getQuery()
            ->execute();
    }

    public function existe(int $exerciceAnnee, int $mois): bool
    {
        return (int) $this->createQueryBuilder('a')
            ->select('COUNT(a.id)')
            ->andWhere('a.exerciceAnnee = :a')
            ->andWhere('a.mois = :m')
            ->setParameter('a', $exerciceAnnee)
            ->setParameter('m', $mois)
            ->getQuery()
            ->getSingleScalarResult() > 0;
    }
}
