<?php

declare(strict_types=1);

namespace App\Repository\ServiceReglement;

use App\Entity\ServiceReglement\FicheDepot;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\DBAL\Connection;
use Doctrine\Persistence\ManagerRegistry;

class FicheDepotRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, FicheDepot::class);
    }

    public function connection(): Connection
    {
        return $this->getEntityManager()->getConnection();
    }

    public function countByUtilisateur(int $utilisateurId): int
    {
        return (int) $this->createQueryBuilder('f')
            ->select('COUNT(f.reference)')
            ->andWhere('f.utilisateur = :utilisateurId')
            ->setParameter('utilisateurId', $utilisateurId)
            ->getQuery()
            ->getSingleScalarResult();
    }

    public function save(FicheDepot $fiche, bool $flush = false): void
    {
        $this->getEntityManager()->persist($fiche);
        if ($flush) {
            $this->getEntityManager()->flush();
        }
    }

    public function remove(FicheDepot $fiche, bool $flush = false): void
    {
        $this->getEntityManager()->remove($fiche);
        if ($flush) {
            $this->getEntityManager()->flush();
        }
    }

    public function flush(): void
    {
        $this->getEntityManager()->flush();
    }
}
