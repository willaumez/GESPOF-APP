<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Repository;

use App\Module\ServiceOperationsFinancieres\Entite\Recette\Rapprochement;
use App\Module\ServiceOperationsFinancieres\Enum\DomaineRapprochement;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<Rapprochement>
 */
class RapprochementRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, Rapprochement::class);
    }

    /**
     * @return list<Rapprochement>
     */
    public function listerParPeriodeDomaine(int $periodeId, DomaineRapprochement $domaine): array
    {
        /** @var list<Rapprochement> $rows */
        $rows = $this->createQueryBuilder('r')
            ->andWhere('r.periode = :pid')
            ->andWhere('r.domaine = :domaine')
            ->setParameter('pid', $periodeId)
            ->setParameter('domaine', $domaine)
            ->orderBy('r.cle', 'ASC')
            ->getQuery()
            ->getResult();

        return $rows;
    }

    public function trouver(
        int $periodeId,
        DomaineRapprochement $domaine,
        string $cle,
    ): ?Rapprochement {
        /** @var Rapprochement|null $row */
        $row = $this->createQueryBuilder('r')
            ->andWhere('r.periode = :pid')
            ->andWhere('r.domaine = :domaine')
            ->andWhere('r.cle = :cle')
            ->setParameter('pid', $periodeId)
            ->setParameter('domaine', $domaine)
            ->setParameter('cle', $cle)
            ->getQuery()
            ->getOneOrNullResult();

        return $row;
    }
}
