<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Repository;

use App\Module\ServiceOperationsFinancieres\Entite\Extraction\ExtractionLancement;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<ExtractionLancement>
 */
class ExtractionLancementRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, ExtractionLancement::class);
    }

    public function trouverEnCours(int $periodeId): ?ExtractionLancement
    {
        /** @var ExtractionLancement|null $row */
        $row = $this->createQueryBuilder('l')
            ->andWhere('l.periode = :pid')
            ->andWhere('l.statut = :st')
            ->setParameter('pid', $periodeId)
            ->setParameter('st', ExtractionLancement::EN_COURS)
            ->orderBy('l.debut', 'DESC')
            ->setMaxResults(1)
            ->getQuery()
            ->getOneOrNullResult();

        return $row;
    }
}
