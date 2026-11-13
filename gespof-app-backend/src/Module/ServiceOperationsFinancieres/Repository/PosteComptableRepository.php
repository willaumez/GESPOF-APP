<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Repository;

use App\Module\ServiceOperationsFinancieres\Entite\Referentiel\PosteComptable;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<PosteComptable>
 */
class PosteComptableRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, PosteComptable::class);
    }

    /**
     * @return list<PosteComptable>
     */
    public function listerParCode(): array
    {
        /** @var list<PosteComptable> $postes */
        $postes = $this->createQueryBuilder('p')
            ->orderBy('p.code', 'ASC')
            ->getQuery()
            ->getResult();

        return $postes;
    }

    public function trouverParCode(string $code): ?PosteComptable
    {
        return $this->find($code);
    }
}
