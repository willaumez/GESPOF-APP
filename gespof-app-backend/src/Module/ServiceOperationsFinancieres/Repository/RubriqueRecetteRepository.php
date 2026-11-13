<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Repository;

use App\Module\ServiceOperationsFinancieres\Entite\Recette\RubriqueRecette;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<RubriqueRecette>
 */
class RubriqueRecetteRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, RubriqueRecette::class);
    }

    /**
     * @return list<RubriqueRecette>
     */
    public function findRacines(): array
    {
        /** @var list<RubriqueRecette> $racines */
        $racines = $this->createQueryBuilder('r')
            ->andWhere('r.parent IS NULL')
            ->orderBy('r.ordre', 'ASC')
            ->addOrderBy('r.code', 'ASC')
            ->getQuery()
            ->getResult();

        return $racines;
    }

    /**
     * @return list<RubriqueRecette>
     */
    public function listerAPlat(): array
    {
        /** @var list<RubriqueRecette> $rubriques */
        $rubriques = $this->createQueryBuilder('r')
            ->orderBy('r.ordre', 'ASC')
            ->addOrderBy('r.code', 'ASC')
            ->getQuery()
            ->getResult();

        return $rubriques;
    }

    public function findByCode(string $code): ?RubriqueRecette
    {
        return $this->find($code);
    }
}
