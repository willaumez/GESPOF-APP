<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Repository;

use App\Module\ServiceOperationsFinancieres\Entite\Referentiel\LoiFinances;
use App\Module\ServiceOperationsFinancieres\Enum\TypeLoiFinances;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<LoiFinances>
 */
class LoiFinancesRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, LoiFinances::class);
    }

    public function trouver(int $exerciceAnnee, TypeLoiFinances $type): ?LoiFinances
    {
        /** @var LoiFinances|null $loi */
        $loi = $this->findOneBy(['exerciceAnnee' => $exerciceAnnee, 'type' => $type]);

        return $loi;
    }

    /**
     * @return list<LoiFinances>
     */
    public function listerParExercice(int $exerciceAnnee): array
    {
        /** @var list<LoiFinances> $rows */
        $rows = $this->createQueryBuilder('l')
            ->andWhere('l.exerciceAnnee = :annee')
            ->setParameter('annee', $exerciceAnnee)
            ->orderBy('l.type', 'ASC')
            ->getQuery()
            ->getResult();

        return $rows;
    }
}
