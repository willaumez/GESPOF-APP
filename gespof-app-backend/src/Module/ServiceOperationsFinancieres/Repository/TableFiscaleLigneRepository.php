<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Repository;

use App\Module\ServiceOperationsFinancieres\Entite\Referentiel\TableFiscaleLigne;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<TableFiscaleLigne>
 */
class TableFiscaleLigneRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, TableFiscaleLigne::class);
    }

    /**
     * @return list<TableFiscaleLigne>
     */
    public function lister(): array
    {
        return $this->createQueryBuilder('l')
            ->orderBy('l.tableCode', 'ASC')
            ->addOrderBy('l.nature', 'ASC')
            ->getQuery()
            ->getResult();
    }
}
