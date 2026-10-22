<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Repository;

use App\Module\ServiceOperationsFinancieres\Entite\Exercice;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<Exercice>
 */
class ExerciceRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, Exercice::class);
    }

    public function findByAnnee(int $annee): ?Exercice
    {
        return $this->find($annee);
    }

    /**
     * @return list<Exercice>
     */
    public function listerParAnneeDesc(): array
    {
        /** @var list<Exercice> $exercices */
        $exercices = $this->createQueryBuilder('e')
            ->orderBy('e.annee', 'DESC')
            ->getQuery()
            ->getResult();

        return $exercices;
    }
}
