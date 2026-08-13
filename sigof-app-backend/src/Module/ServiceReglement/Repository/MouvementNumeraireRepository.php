<?php

declare(strict_types=1);

namespace App\Module\ServiceReglement\Repository;

use App\Module\ServiceReglement\Entite\MouvementNumeraire;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

class MouvementNumeraireRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, MouvementNumeraire::class);
    }

    public function save(MouvementNumeraire $mouvement, bool $flush = false): void
    {
        $this->getEntityManager()->persist($mouvement);
        if ($flush) {
            $this->getEntityManager()->flush();
        }
    }

    public function remove(MouvementNumeraire $mouvement, bool $flush = false): void
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
