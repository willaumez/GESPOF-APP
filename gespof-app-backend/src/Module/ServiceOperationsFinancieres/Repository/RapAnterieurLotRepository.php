<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Repository;

use App\Module\ServiceOperationsFinancieres\Entite\Referentiel\RapAnterieurLot;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<RapAnterieurLot>
 */
class RapAnterieurLotRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, RapAnterieurLot::class);
    }

    public function trouverDernier(int $exerciceAnnee): ?RapAnterieurLot
    {
        /** @var RapAnterieurLot|null $lot */
        $lot = $this->createQueryBuilder('l')
            ->andWhere('l.exerciceAnnee = :annee')
            ->setParameter('annee', $exerciceAnnee)
            ->orderBy('l.importeLe', 'DESC')
            ->setMaxResults(1)
            ->getQuery()
            ->getOneOrNullResult();

        return $lot;
    }
}
