<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Repository;

use App\Module\ServiceOperationsFinancieres\Entite\Recette\CompteDouane;
use App\Module\ServiceOperationsFinancieres\Enum\TypeCompteDouane;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<CompteDouane>
 */
class CompteDouaneRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, CompteDouane::class);
    }

    /**
     * @return list<CompteDouane>
     */
    public function listerTous(): array
    {
        /** @var list<CompteDouane> $comptes */
        $comptes = $this->createQueryBuilder('c')
            ->orderBy('c.type', 'ASC')
            ->addOrderBy('c.compte', 'ASC')
            ->getQuery()
            ->getResult();

        return $comptes;
    }

    /**
     * @return list<CompteDouane>
     */
    public function trouverParType(TypeCompteDouane $type): array
    {
        /** @var list<CompteDouane> $comptes */
        $comptes = $this->createQueryBuilder('c')
            ->andWhere('c.type = :type')
            ->setParameter('type', $type)
            ->orderBy('c.compte', 'ASC')
            ->getQuery()
            ->getResult();

        return $comptes;
    }

    public function trouverParCompte(string $compte): ?CompteDouane
    {
        return $this->find($compte);
    }
}
