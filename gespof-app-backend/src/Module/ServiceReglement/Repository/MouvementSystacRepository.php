<?php

declare(strict_types=1);

namespace App\Module\ServiceReglement\Repository;

use App\Module\ServiceReglement\Entite\MouvementSystac;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

class MouvementSystacRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, MouvementSystac::class);
    }

    public function save(MouvementSystac $mouvement, bool $flush = false): void
    {
        $this->getEntityManager()->persist($mouvement);
        if ($flush) {
            $this->getEntityManager()->flush();
        }
    }

    public function remove(MouvementSystac $mouvement, bool $flush = false): void
    {
        $this->getEntityManager()->remove($mouvement);
        if ($flush) {
            $this->getEntityManager()->flush();
        }
    }

    public function flush(): void
    {
        $this->getEntityManager()->flush();
    }
}
