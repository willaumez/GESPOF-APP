<?php

declare(strict_types=1);

namespace App\Module\ServiceReglement\Repository;

use App\Module\ServiceReglement\Entite\Observation;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

class ObservationRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, Observation::class);
    }

    public function save(Observation $observation, bool $flush = false): void
    {
        $this->getEntityManager()->persist($observation);
        if ($flush) {
            $this->getEntityManager()->flush();
        }
    }

    public function remove(Observation $observation, bool $flush = false): void
    {
        $this->getEntityManager()->remove($observation);
        if ($flush) {
            $this->getEntityManager()->flush();
        }
    }

    public function flush(): void
    {
        $this->getEntityManager()->flush();
    }
}
