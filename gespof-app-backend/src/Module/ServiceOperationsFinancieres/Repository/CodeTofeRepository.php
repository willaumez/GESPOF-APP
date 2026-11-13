<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Repository;

use App\Module\ServiceOperationsFinancieres\Entite\Referentiel\CodeTofe;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<CodeTofe>
 */
class CodeTofeRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, CodeTofe::class);
    }

    /**
     * @return list<CodeTofe>
     */
    public function listerParCode(): array
    {
        /** @var list<CodeTofe> $codes */
        $codes = $this->createQueryBuilder('c')
            ->orderBy('c.code', 'ASC')
            ->getQuery()
            ->getResult();

        return $codes;
    }

    public function findByCode(string $code): ?CodeTofe
    {
        return $this->find($code);
    }
}
