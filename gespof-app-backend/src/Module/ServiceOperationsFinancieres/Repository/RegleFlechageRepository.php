<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Repository;

use App\Module\ServiceOperationsFinancieres\Entite\Referentiel\RegleFlechage;
use App\Module\ServiceOperationsFinancieres\Enum\DomaineFlechage;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<RegleFlechage>
 */
class RegleFlechageRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, RegleFlechage::class);
    }

    /**
     * @param list<DomaineFlechage> $domaines
     *
     * @return list<RegleFlechage>
     */
    public function listerParDomaines(array $domaines): array
    {
        if ($domaines === []) {
            return [];
        }

        /** @var list<RegleFlechage> $regles */
        $regles = $this->createQueryBuilder('r')
            ->andWhere('r.domaine IN (:domaines)')
            ->setParameter('domaines', $domaines)
            ->orderBy('r.priorite', 'ASC')
            ->addOrderBy('r.id', 'ASC')
            ->getQuery()
            ->getResult();

        return $regles;
    }

    /**
     * @return list<RegleFlechage>
     */
    public function listerTout(): array
    {
        /** @var list<RegleFlechage> $regles */
        $regles = $this->createQueryBuilder('r')
            ->orderBy('r.domaine', 'ASC')
            ->addOrderBy('r.priorite', 'ASC')
            ->addOrderBy('r.id', 'ASC')
            ->getQuery()
            ->getResult();

        return $regles;
    }
}
