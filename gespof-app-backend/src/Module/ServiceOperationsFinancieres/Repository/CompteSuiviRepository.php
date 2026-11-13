<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Repository;

use App\Module\ServiceOperationsFinancieres\Entite\Referentiel\CompteSuivi;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<CompteSuivi>
 */
class CompteSuiviRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, CompteSuivi::class);
    }

    /**
     * @return list<CompteSuivi>
     */
    public function listerParOrdre(): array
    {
        /** @var list<CompteSuivi> $comptes */
        $comptes = $this->createQueryBuilder('c')
            ->orderBy('c.ordre', 'ASC')
            ->addOrderBy('c.compte', 'ASC')
            ->addOrderBy('c.nature', 'ASC')
            ->getQuery()
            ->getResult();

        return $comptes;
    }

    public function trouver(string $compte, string $nature): ?CompteSuivi
    {
        return $this->find(['compte' => $compte, 'nature' => $nature]);
    }
}
