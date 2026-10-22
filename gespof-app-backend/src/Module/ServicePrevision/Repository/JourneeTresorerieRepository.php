<?php

declare(strict_types=1);

namespace App\Module\ServicePrevision\Repository;

use App\Module\ServicePrevision\Entite\JourneeTresorerie\JourneeTresorerie;
use App\Module\ServicePrevision\Enum\EtatJournee;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<JourneeTresorerie>
 */
class JourneeTresorerieRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, JourneeTresorerie::class);
    }

    /** Prochain incrément journalier pour genererReference() (1 si aucune journée ce jour). */
    public function prochainIncrementPourDate(\DateTimeInterface $date): int
    {
        $prefixe = sprintf('JT-%s-', $date->format('d-m-Y'));

        $dernieres = $this->createQueryBuilder('j')
            ->select('j.reference')
            ->where('j.reference LIKE :prefixe')
            ->setParameter('prefixe', $prefixe . '%')
            ->orderBy('j.reference', 'DESC')
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
     * Journée unique du jour calendaire (une seule par date).
     * Cherche d'abord par date_creation, puis par préfixe de référence JT-dd-mm-YYYY-.
     */
    public function trouverDuJour(\DateTimeInterface $date): ?JourneeTresorerie
    {
        $debut = \DateTimeImmutable::createFromInterface($date)->setTime(0, 0, 0);
        $fin = $debut->modify('+1 day');
        $prefixe = sprintf('JT-%s-', $debut->format('d-m-Y'));

        return $this->createQueryBuilder('j')
            ->where('j.dateCreation >= :debut AND j.dateCreation < :fin')
            ->orWhere('j.reference LIKE :prefixe')
            ->setParameter('debut', $debut)
            ->setParameter('fin', $fin)
            ->setParameter('prefixe', $prefixe . '%')
            ->orderBy('j.dateCreation', 'DESC')
            ->setMaxResults(1)
            ->getQuery()
            ->getOneOrNullResult();
    }

    public function trouverDerniere(): ?JourneeTresorerie
    {
        return $this->createQueryBuilder('j')
            ->orderBy('j.dateCreation', 'DESC')
            ->addOrderBy('j.reference', 'DESC')
            ->setMaxResults(1)
            ->getQuery()
            ->getOneOrNullResult();
    }

    public function trouverPrecedente(JourneeTresorerie $courante): ?JourneeTresorerie
    {
        return $this->createQueryBuilder('j')
            ->andWhere('j.reference != :ref')
            ->andWhere('j.dateCreation < :date OR (j.dateCreation = :date AND j.reference < :ref)')
            ->setParameter('ref', $courante->getReference())
            ->setParameter('date', $courante->getDateCreation())
            ->orderBy('j.dateCreation', 'DESC')
            ->addOrderBy('j.reference', 'DESC')
            ->setMaxResults(1)
            ->getQuery()
            ->getOneOrNullResult();
    }

    /**
     * Solde d'ouverture de la journée précédente, sans hydrater
     * le snapshot JSON operations_jour (peut être volumineux).
     */
    public function soldeOuverturePrecedente(JourneeTresorerie $courante): ?string
    {
        $resultat = $this->createQueryBuilder('j')
            ->select('j.soldeOuverture')
            ->andWhere('j.reference != :ref')
            ->andWhere('j.dateCreation < :date OR (j.dateCreation = :date AND j.reference < :ref)')
            ->setParameter('ref', $courante->getReference())
            ->setParameter('date', $courante->getDateCreation())
            ->orderBy('j.dateCreation', 'DESC')
            ->addOrderBy('j.reference', 'DESC')
            ->setMaxResults(1)
            ->getQuery()
            ->getOneOrNullResult();

        if ($resultat === null) {
            return null;
        }
        if (is_array($resultat) && isset($resultat['soldeOuverture'])) {
            return (string) $resultat['soldeOuverture'];
        }

        return is_scalar($resultat) ? (string) $resultat : null;
    }

    /**
     * Liste paginée avec recherche (référence, fiches liées) et filtres.
     *
     * @return array{journees: list<JourneeTresorerie>, total: int, page: int, pages: int}
     */
    public function filtrer(
        int $page,
        int $limite,
        ?string $recherche = null,
        ?EtatJournee $etat = null,
        ?\DateTimeImmutable $jour = null,
        ?\DateTimeImmutable $debut = null,
        ?\DateTimeImmutable $fin = null,
    ): array {
        $qb = $this->createQueryBuilder('j')
            ->leftJoin('j.ficheBleue', 'fb')
            ->addSelect('fb')
            ->leftJoin('j.ficheExecution', 'fe')
            ->addSelect('fe')
            ->orderBy('j.dateCreation', 'DESC')
            ->addOrderBy('j.reference', 'DESC');

        if ($recherche !== null && $recherche !== '') {
            $qb->andWhere($qb->expr()->orX(
                'LOWER(j.reference) LIKE :q',
                'LOWER(fb.reference) LIKE :q',
                'LOWER(fe.reference) LIKE :q',
            ))->setParameter('q', '%' . mb_strtolower($recherche) . '%');
        }

        if ($etat !== null) {
            $qb->andWhere('j.etat = :etat')->setParameter('etat', $etat);
        }

        if ($jour !== null) {
            $debutJour = $jour->setTime(0, 0, 0);
            $finJour = $debutJour->modify('+1 day');
            $prefixe = sprintf('JT-%s-', $debutJour->format('d-m-Y'));
            $qb->andWhere($qb->expr()->orX(
                'j.dateCreation >= :debutJour AND j.dateCreation < :finJour',
                'j.reference LIKE :prefixeJour',
            ))
                ->setParameter('debutJour', $debutJour)
                ->setParameter('finJour', $finJour)
                ->setParameter('prefixeJour', $prefixe . '%');
        } else {
            // Date calendaire de la journée = JJ-MM-AAAA encodé dans JT-JJ-MM-AAAA-NNN
            // (CONCAT → YYYY-MM-DD comparable lexicographiquement).
            $dateIsoRef = "CONCAT(SUBSTRING(j.reference, 12, 4), '-', SUBSTRING(j.reference, 9, 2), '-', SUBSTRING(j.reference, 4, 2))";
            if ($debut !== null) {
                $qb->andWhere($dateIsoRef . ' >= :debutIso')
                    ->setParameter('debutIso', $debut->format('Y-m-d'));
            }
            if ($fin !== null) {
                $qb->andWhere($dateIsoRef . ' <= :finIso')
                    ->setParameter('finIso', $fin->format('Y-m-d'));
            }
        }

        $total = (int) (clone $qb)
            ->resetDQLPart('orderBy')
            ->select('COUNT(DISTINCT j.reference)')
            ->getQuery()
            ->getSingleScalarResult();

        $pages = max(1, (int) ceil($total / max(1, $limite)));
        $page = max(1, min($page, $pages));

        /** @var list<JourneeTresorerie> $journees */
        $journees = $qb
            ->setFirstResult(($page - 1) * $limite)
            ->setMaxResults($limite)
            ->getQuery()
            ->getResult();

        return [
            'journees' => $journees,
            'total' => $total,
            'page' => $page,
            'pages' => $pages,
        ];
    }

    public function save(JourneeTresorerie $journee, bool $flush = false): void
    {
        $this->getEntityManager()->persist($journee);
        if ($flush) {
            $this->getEntityManager()->flush();
        }
    }

    public function remove(JourneeTresorerie $journee, bool $flush = false): void
    {
        $this->getEntityManager()->remove($journee);
        if ($flush) {
            $this->getEntityManager()->flush();
        }
    }

    public function flush(): void
    {
        $this->getEntityManager()->flush();
    }
}
