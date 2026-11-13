<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Repository;

use App\Module\ServiceOperationsFinancieres\Entite\Recette\RecetteFiscaleMode;
use App\Module\ServiceOperationsFinancieres\Enum\ModeRecouvrement;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<RecetteFiscaleMode>
 */
class RecetteFiscaleModeRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, RecetteFiscaleMode::class);
    }

    /**
     * @return list<RecetteFiscaleMode>
     */
    public function listerParPeriode(int $periodeId): array
    {
        /** @var list<RecetteFiscaleMode> $rows */
        $rows = $this->createQueryBuilder('r')
            ->andWhere('r.periode = :pid')
            ->setParameter('pid', $periodeId)
            ->orderBy('r.rubriqueCode', 'ASC')
            ->addOrderBy('r.mode', 'ASC')
            ->getQuery()
            ->getResult();

        return $rows;
    }

    public function trouver(int $periodeId, string $rubriqueCode, ModeRecouvrement $mode): ?RecetteFiscaleMode
    {
        /** @var RecetteFiscaleMode|null $row */
        $row = $this->createQueryBuilder('r')
            ->andWhere('r.periode = :pid')
            ->andWhere('r.rubriqueCode = :code')
            ->andWhere('r.mode = :mode')
            ->setParameter('pid', $periodeId)
            ->setParameter('code', $rubriqueCode)
            ->setParameter('mode', $mode)
            ->getQuery()
            ->getOneOrNullResult();

        return $row;
    }

    /**
     * Saisies de l'exercice jusqu'au mois inclus (pour cumul YTD).
     *
     * @param list<int> $periodeIds
     *
     * @return list<RecetteFiscaleMode>
     */
    public function listerParPeriodes(array $periodeIds): array
    {
        if ($periodeIds === []) {
            return [];
        }

        /** @var list<RecetteFiscaleMode> $rows */
        $rows = $this->createQueryBuilder('r')
            ->addSelect('p')
            ->innerJoin('r.periode', 'p')
            ->andWhere('r.periode IN (:pids)')
            ->setParameter('pids', $periodeIds)
            ->getQuery()
            ->getResult();

        return $rows;
    }
}
