<?php

declare(strict_types=1);

namespace App\Module\ServicePrevision\Repository;

use App\Module\ServicePrevision\Entite\FicheBleu\FicheBleue;
use App\Module\ServicePrevision\Enum\StatutFiche;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<FicheBleue>
 */
class FicheBleueRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, FicheBleue::class);
    }

    /** Prochain incrément journalier pour genererReference() (1 si aucune fiche ce jour). */
    public function prochainIncrementPourDate(\DateTimeInterface $date): int
    {
        $prefixe = sprintf('FB-%s-', $date->format('Y-m-d'));

        $dernieres = $this->createQueryBuilder('f')
            ->select('f.reference')
            ->where('f.reference LIKE :prefixe')
            ->setParameter('prefixe', $prefixe . '%')
            ->orderBy('f.reference', 'DESC')
            ->setMaxResults(1)
            ->getQuery()
            ->getScalarResult();

        if ($dernieres === []) {
            return 1;
        }

        $reference = (string) $dernieres[0]['reference'];
        $suffixe = substr($reference, strlen($prefixe));

        return max(1, ((int) $suffixe) + 1);
    }

    /**
     * Fiches Bleues dont la date de création tombe le jour calendaire donné
     * (fuseau de l'appli), plus récentes d'abord.
     *
     * @return list<FicheBleue>
     */
    public function trouverParDateCreation(\DateTimeInterface $date): array
    {
        $debut = \DateTimeImmutable::createFromInterface($date)->setTime(0, 0, 0);
        $fin = $debut->modify('+1 day');

        /** @var list<FicheBleue> $fiches */
        $fiches = $this->createQueryBuilder('f')
            ->andWhere('f.dateCreation >= :debut')
            ->andWhere('f.dateCreation < :fin')
            ->setParameter('debut', $debut)
            ->setParameter('fin', $fin)
            ->orderBy('f.dateCreation', 'DESC')
            ->addOrderBy('f.id', 'DESC')
            ->getQuery()
            ->getResult();

        return $fiches;
    }

    /**
     * Liste paginée avec recherche (référence, créateur, journée) et filtres.
     *
     * @return array{fiches: list<FicheBleue>, total: int}
     */
    public function filtrer(
        int $page,
        int $limite,
        ?string $recherche = null,
        ?StatutFiche $statut = null,
        ?\DateTimeImmutable $jour = null,
        ?\DateTimeImmutable $debut = null,
        ?\DateTimeImmutable $fin = null,
    ): array {
        $qb = $this->createQueryBuilder('f')
            ->leftJoin('f.journeeTresorerie', 'j')
            ->orderBy('f.dateCreation', 'DESC')
            ->addOrderBy('f.id', 'DESC');

        if ($recherche !== null && $recherche !== '') {
            $qb->andWhere($qb->expr()->orX(
                'LOWER(f.reference) LIKE :q',
                'LOWER(f.createur) LIKE :q',
                'LOWER(j.reference) LIKE :q',
            ))->setParameter('q', '%' . mb_strtolower($recherche) . '%');
        }

        if ($statut !== null) {
            $qb->andWhere('f.statut = :statut')->setParameter('statut', $statut);
        }

        if ($jour !== null) {
            $debutJour = $jour->setTime(0, 0, 0);
            $finJour = $debutJour->modify('+1 day');
            $qb->andWhere('f.dateCreation >= :debutJour')
                ->andWhere('f.dateCreation < :finJour')
                ->setParameter('debutJour', $debutJour)
                ->setParameter('finJour', $finJour);
        } else {
            if ($debut !== null) {
                $qb->andWhere('f.dateCreation >= :debut')
                    ->setParameter('debut', $debut->setTime(0, 0, 0));
            }
            if ($fin !== null) {
                $qb->andWhere('f.dateCreation < :fin')
                    ->setParameter('fin', $fin->setTime(0, 0, 0)->modify('+1 day'));
            }
        }

        $total = (int) (clone $qb)
            ->resetDQLPart('orderBy')
            ->select('COUNT(DISTINCT f.id)')
            ->getQuery()
            ->getSingleScalarResult();

        $pages = max(1, (int) ceil($total / max(1, $limite)));
        $page = max(1, min($page, $pages));

        /** @var list<FicheBleue> $fiches */
        $fiches = $qb
            ->setFirstResult(($page - 1) * $limite)
            ->setMaxResults($limite)
            ->getQuery()
            ->getResult();

        return ['fiches' => $fiches, 'total' => $total];
    }

    public function save(FicheBleue $fiche, bool $flush = false): void
    {
        $this->getEntityManager()->persist($fiche);
        if ($flush) {
            $this->getEntityManager()->flush();
        }
    }

    public function remove(FicheBleue $fiche, bool $flush = false): void
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
