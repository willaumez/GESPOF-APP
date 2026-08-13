<?php

declare(strict_types=1);

namespace App\Repository\ServiceReglement;

use App\Entity\ServiceReglement\LigneSystac;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

class LigneSystacRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, LigneSystac::class);
    }

    public function save(LigneSystac $ligne, bool $flush = false): void
    {
        $this->getEntityManager()->persist($ligne);
        if ($flush) {
            $this->getEntityManager()->flush();
        }
    }

    public function remove(LigneSystac $ligne, bool $flush = false): void
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
