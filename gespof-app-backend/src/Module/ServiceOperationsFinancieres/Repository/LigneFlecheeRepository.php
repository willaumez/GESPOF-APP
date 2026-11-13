<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Repository;

use App\Module\ServiceOperationsFinancieres\Entite\Referentiel\LigneFlechee;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<LigneFlechee>
 */
class LigneFlecheeRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, LigneFlechee::class);
    }

    /**
     * @return list<LigneFlechee>
     */
    public function listerParPeriode(int $periodeId): array
    {
        /** @var list<LigneFlechee> $lignes */
        $lignes = $this->createQueryBuilder('l')
            ->andWhere('l.periode = :pid')
            ->setParameter('pid', $periodeId)
            ->orderBy('l.rubriqueCode', 'ASC')
            ->getQuery()
            ->getResult();

        return $lignes;
    }

    public function supprimerParPeriodeEtSource(int $periodeId, string $sourceTable): int
    {
        return $this->createQueryBuilder('l')
            ->delete()
            ->andWhere('l.periode = :pid')
            ->andWhere('l.sourceTable = :src')
            ->setParameter('pid', $periodeId)
            ->setParameter('src', $sourceTable)
            ->getQuery()
            ->execute();
    }

    /**
     * Agrégats code × mois pour un exercice (toutes sources ligne_flechee).
     *
     * @return list<array{rubrique_code: string, mois: int, montant: string}>
     */
    public function agregatsParExercice(int $exerciceAnnee): array
    {
        /** @var list<array{rubrique_code: string, mois: int|string, montant: string}> $rows */
        $rows = $this->createQueryBuilder('l')
            ->select('l.rubriqueCode AS rubrique_code', 'l.mois AS mois', 'SUM(l.montant) AS montant')
            ->innerJoin('l.periode', 'p')
            ->innerJoin('p.exercice', 'e')
            ->andWhere('e.annee = :annee')
            ->andWhere('l.rubriqueCode <> :none')
            ->setParameter('annee', $exerciceAnnee)
            ->setParameter('none', 'NONE')
            ->groupBy('l.rubriqueCode', 'l.mois')
            ->orderBy('l.rubriqueCode', 'ASC')
            ->addOrderBy('l.mois', 'ASC')
            ->getQuery()
            ->getArrayResult();

        return array_map(
            static fn (array $r): array => [
                'rubrique_code' => (string) $r['rubrique_code'],
                'mois' => (int) $r['mois'],
                'montant' => number_format((float) $r['montant'], 2, '.', ''),
            ],
            $rows,
        );
    }
}
