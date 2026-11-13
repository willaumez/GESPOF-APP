<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Repository;

use App\Module\ServiceOperationsFinancieres\Entite\Recette\SocietePetroliere;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<SocietePetroliere>
 */
class SocietePetroliereRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, SocietePetroliere::class);
    }

    /**
     * @return list<SocietePetroliere>
     */
    public function listerParMatricule(): array
    {
        /** @var list<SocietePetroliere> $societes */
        $societes = $this->createQueryBuilder('s')
            ->orderBy('s.matricule', 'ASC')
            ->getQuery()
            ->getResult();

        return $societes;
    }

    public function trouverParMatricule(string $matricule): ?SocietePetroliere
    {
        return $this->find($matricule);
    }
}
