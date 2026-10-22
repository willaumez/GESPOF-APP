<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Repository;

use App\Module\ServiceOperationsFinancieres\Entite\Depense;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<Depense>
 */
class DepenseRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, Depense::class);
    }

    /**
     * @return list<Depense>
     */
    public function findByExerciceEtMois(int $annee, int $mois): array
    {
        /** @var list<Depense> $lignes */
        $lignes = $this->createQueryBuilder('r')
            ->innerJoin('r.exercice', 'e')
            ->addSelect('e')
            ->innerJoin('r.rubrique', 'rb')
            ->addSelect('rb')
            ->andWhere('e.annee = :annee')
            ->andWhere('r.mois = :mois')
            ->setParameter('annee', $annee)
            ->setParameter('mois', $mois)
            ->orderBy('rb.code', 'ASC')
            ->getQuery()
            ->getResult();

        return $lignes;
    }

    /**
     * Total annuel par rubrique (agrégation SQL).
     *
     * @return list<array{rubrique_code: string, total: string}>
     */
    public function sommeParRubrique(int $annee): array
    {
        /** @var list<array{rubrique_code: string, total: string|null}> $lignes */
        $lignes = $this->createQueryBuilder('r')
            ->select('IDENTITY(r.rubrique) AS rubrique_code', 'SUM(r.montantTotal) AS total')
            ->innerJoin('r.exercice', 'e')
            ->andWhere('e.annee = :annee')
            ->setParameter('annee', $annee)
            ->groupBy('r.rubrique')
            ->orderBy('rubrique_code', 'ASC')
            ->getQuery()
            ->getArrayResult();

        return array_map(
            static fn (array $ligne): array => [
                'rubrique_code' => (string) $ligne['rubrique_code'],
                'total' => $ligne['total'] === null ? '0.00' : (string) $ligne['total'],
            ],
            $lignes,
        );
    }
}
