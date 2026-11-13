<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Repository;

use App\Module\ServiceOperationsFinancieres\Entite\Referentiel\SrotPublication;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<SrotPublication>
 */
class SrotPublicationRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, SrotPublication::class);
    }

    /**
     * @return list<SrotPublication>
     */
    public function lister(?int $exerciceAnnee = null, ?int $periodeId = null): array
    {
        $qb = $this->createQueryBuilder('p')
            ->orderBy('p.publieLe', 'DESC')
            ->addOrderBy('p.version', 'DESC');
        if ($exerciceAnnee !== null) {
            $qb->andWhere('p.exerciceAnnee = :a')->setParameter('a', $exerciceAnnee);
        }
        if ($periodeId !== null) {
            $qb->andWhere('p.periode = :pid')->setParameter('pid', $periodeId);
        }

        /** @var list<SrotPublication> $rows */
        $rows = $qb->getQuery()->getResult();

        return $rows;
    }

    public function prochaineVersion(int $periodeId): int
    {
        $max = $this->createQueryBuilder('p')
            ->select('MAX(p.version)')
            ->andWhere('p.periode = :pid')
            ->setParameter('pid', $periodeId)
            ->getQuery()
            ->getSingleScalarResult();

        return ((int) $max) + 1;
    }
}
