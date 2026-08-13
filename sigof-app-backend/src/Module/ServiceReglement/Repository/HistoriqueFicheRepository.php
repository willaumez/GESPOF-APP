<?php

declare(strict_types=1);

namespace App\Module\ServiceReglement\Repository;

use App\Module\ServiceReglement\Entite\HistoriqueFiche;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

class HistoriqueFicheRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, HistoriqueFiche::class);
    }

    public function save(HistoriqueFiche $historique, bool $flush = false): void
    {
        $this->getEntityManager()->persist($historique);
        if ($flush) {
            $this->getEntityManager()->flush();
        }
    }

    public function remove(HistoriqueFiche $historique, bool $flush = false): void
    {
        $this->getEntityManager()->remove($historique);
        if ($flush) {
            $this->getEntityManager()->flush();
        }
    }

    public function flush(): void
    {
        $this->getEntityManager()->flush();
    }

    public function countByUtilisateur(int $utilisateurId): int
    {
        return (int) $this->createQueryBuilder('h')
            ->select('COUNT(h.id)')
            ->andWhere('h.utilisateur = :utilisateurId')
            ->setParameter('utilisateurId', $utilisateurId)
            ->getQuery()
            ->getSingleScalarResult();
    }

    public function listerPagine(
        ?\DateTimeImmutable $dateDebut,
        ?\DateTimeImmutable $dateFinExclusive,
        ?int $utilisateurId,
        int $page,
        int $limit,
        bool $toutAfficher,
    ): array {
        $qb = $this->createQueryBuilder('h')
            ->leftJoin('h.ficheDepense', 'f')->addSelect('f')
            ->leftJoin('h.utilisateur', 'u')->addSelect('u');

        if ($dateDebut !== null) {
            $qb->andWhere('h.dateAction >= :dateDebut')->setParameter('dateDebut', $dateDebut);
        }

        if ($dateFinExclusive !== null) {
            $qb->andWhere('h.dateAction < :dateFin')->setParameter('dateFin', $dateFinExclusive);
        }

        if ($utilisateurId !== null) {
            $qb->andWhere('u.id = :utilisateurId')->setParameter('utilisateurId', $utilisateurId);
        }

        $total = (int) (clone $qb)->select('COUNT(h.id)')->getQuery()->getSingleScalarResult();

        $qb->orderBy('h.dateAction', 'DESC');

        if (!$toutAfficher) {
            $qb->setFirstResult(($page - 1) * $limit)->setMaxResults($limit);
        }

        return [
            'historique' => $qb->getQuery()->getResult(),
            'total' => $total,
        ];
    }
}
