<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Repository;

use App\Module\ServiceOperationsFinancieres\Entite\Referentiel\TableFiscaleCompte;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<TableFiscaleCompte>
 */
class TableFiscaleCompteRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, TableFiscaleCompte::class);
    }

    /**
     * @return list<TableFiscaleCompte>
     */
    public function lister(): array
    {
        return $this->createQueryBuilder('c')
            ->orderBy('c.compte', 'ASC')
            ->getQuery()
            ->getResult();
    }

    public function trouverParCompte(string $compte): ?TableFiscaleCompte
    {
        return $this->find($compte);
    }
}
