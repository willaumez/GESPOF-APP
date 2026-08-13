<?php

declare(strict_types=1);

namespace App\Module\ServiceReglement\Repository;

use App\Module\ServiceReglement\Model\LigneSygma;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

class LigneSygmaRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, LigneSygma::class);
    }

    public function save(LigneSygma $ligne, bool $flush = false): void
    {
        $this->getEntityManager()->persist($ligne);
        if ($flush) {
            $this->getEntityManager()->flush();
        }
    }

    public function remove(LigneSygma $ligne, bool $flush = false): void
    {
        $this->getEntityManager()->remove($ligne);
        if ($flush) {
            $this->getEntityManager()->flush();
        }
    }

    public function flush(): void
    {
        $this->getEntityManager()->flush();
    }
}
