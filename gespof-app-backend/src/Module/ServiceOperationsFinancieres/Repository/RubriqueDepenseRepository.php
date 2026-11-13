<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Repository;

use App\Module\ServiceOperationsFinancieres\Entite\Referentiel\RubriqueDepense;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<RubriqueDepense>
 */
class RubriqueDepenseRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, RubriqueDepense::class);
    }

    /**
     * @return list<RubriqueDepense>
     */
    public function findRacines(): array
    {
        /** @var list<RubriqueDepense> $racines */
        $racines = $this->createQueryBuilder('r')
            ->andWhere('r.parent IS NULL')
            ->orderBy('r.ordre', 'ASC')
            ->addOrderBy('r.code', 'ASC')
            ->getQuery()
            ->getResult();

        return $racines;
    }

    /**
     * @return list<RubriqueDepense>
     */
    public function listerAPlat(): array
    {
        /** @var list<RubriqueDepense> $rubriques */
        $rubriques = $this->createQueryBuilder('r')
            ->orderBy('r.ordre', 'ASC')
            ->addOrderBy('r.code', 'ASC')
            ->getQuery()
            ->getResult();

        return $rubriques;
    }

    public function findByCode(string $code): ?RubriqueDepense
    {
        return $this->find($code);
    }
}
