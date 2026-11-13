<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Repository;

use App\Module\ServiceOperationsFinancieres\Entite\Import\DcReglement;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<DcReglement>
 */
class DcReglementRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, DcReglement::class);
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function listerTableauParLot(int $lotId, int $limit = 20, int $offset = 0): array
    {
        /** @var list<array<string, mixed>> $rows */
        $rows = $this->createQueryBuilder('r')
            ->select(
                'r.id AS id',
                'r.type AS type',
                'r.type1 AS type_1',
                'r.categ AS categ',
                'r.ex AS ex',
                'r.datRegl AS dat_regl',
                'r.ordonnance AS ordonnance',
                'r.nRegl AS n_regl',
                'r.dEmis AS d_emis',
                'r.min AS min',
                'r.lMin AS l_min',
                'r.mission AS mission',
                'r.lMis AS l_mis',
                'r.prog AS prog',
                'r.action AS action',
                'r.titre AS titre',
                'r.bop AS bop',
                'r.lBop AS l_bop',
                'r.uo AS uo',
                'r.lUo AS l_uo',
                'r.pc AS pc',
                'r.libPc AS lib_pc',
                'r.lProg AS l_prog',
                'r.nat AS nat',
                'r.nature AS nature',
                'r.banque AS banque',
                'r.mdr AS mdr',
                'r.compteBanc AS compte_banc',
                'r.matric AS matric',
                'r.nom AS nom',
                'r.mRegl AS m_regl',
                'r.mNet AS m_net',
                'r.mPrecTva AS m_prec_tva',
                'r.nMandatTva AS n_mandat_tva',
                'r.objet AS objet',
                'r.numBv AS num_bv',
                'r.nCbanq AS n_cbanq',
                'r.dEche AS d_eche',
            )
            ->andWhere('r.lot = :lid')
            ->setParameter('lid', $lotId)
            ->orderBy('r.datRegl', 'ASC')
            ->addOrderBy('r.ordonnance', 'ASC')
            ->addOrderBy('r.nRegl', 'ASC')
            ->addOrderBy('r.id', 'ASC')
            ->setFirstResult(max(0, $offset))
            ->setMaxResults(max(1, $limit))
            ->getQuery()
            ->getArrayResult();

        return $rows;
    }

    public function compterParLot(int $lotId): int
    {
        return (int) $this->createQueryBuilder('r')
            ->select('COUNT(r.id)')
            ->andWhere('r.lot = :lid')
            ->setParameter('lid', $lotId)
            ->getQuery()
            ->getSingleScalarResult();
    }

    /**
     * @param list<int> $lotIds
     *
     * @return list<DcReglement>
     */
    public function listerParLots(array $lotIds): array
    {
        if ($lotIds === []) {
            return [];
        }

        /** @var list<DcReglement> $rows */
        $rows = $this->createQueryBuilder('r')
            ->andWhere('r.lot IN (:ids)')
            ->setParameter('ids', $lotIds)
            ->orderBy('r.datRegl', 'ASC')
            ->addOrderBy('r.id', 'ASC')
            ->getQuery()
            ->getResult();

        return $rows;
    }
}

