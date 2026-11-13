<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Repository;

use App\Module\ServiceOperationsFinancieres\Entite\Referentiel\RapportCommentaire;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/** @extends ServiceEntityRepository<RapportCommentaire> */
class RapportCommentaireRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, RapportCommentaire::class);
    }

    /**
     * @return list<RapportCommentaire>
     */
    public function listerParPeriode(int $periodeId): array
    {
        /** @var list<RapportCommentaire> $rows */
        $rows = $this->createQueryBuilder('c')
            ->andWhere('c.periode = :p')
            ->setParameter('p', $periodeId)
            ->getQuery()
            ->getResult();

        return $rows;
    }

    public function trouver(int $periodeId, string $cle): ?RapportCommentaire
    {
        return $this->findOneBy(['periode' => $periodeId, 'cle' => $cle]);
    }
}
