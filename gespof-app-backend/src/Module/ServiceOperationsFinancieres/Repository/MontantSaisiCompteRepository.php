<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Repository;

use App\Module\ServiceOperationsFinancieres\Entite\Import\MontantSaisiCompte;
use App\Module\ServiceOperationsFinancieres\Enum\SensMontantCompte;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<MontantSaisiCompte>
 */
class MontantSaisiCompteRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, MontantSaisiCompte::class);
    }

    public function trouver(
        int $periodeId,
        string $compte,
        SensMontantCompte $sens,
    ): ?MontantSaisiCompte {
        /** @var MontantSaisiCompte|null $row */
        $row = $this->createQueryBuilder('m')
            ->andWhere('m.periode = :pid')
            ->andWhere('m.compte = :compte')
            ->andWhere('m.sens = :sens')
            ->setParameter('pid', $periodeId)
            ->setParameter('compte', $compte)
            ->setParameter('sens', $sens)
            ->getQuery()
            ->getOneOrNullResult();

        return $row;
    }

    /**
     * @return list<MontantSaisiCompte>
     */
    public function listerParPeriode(int $periodeId): array
    {
        /** @var list<MontantSaisiCompte> $rows */
        $rows = $this->createQueryBuilder('m')
            ->andWhere('m.periode = :pid')
            ->setParameter('pid', $periodeId)
            ->orderBy('m.compte', 'ASC')
            ->getQuery()
            ->getResult();

        return $rows;
    }
}
