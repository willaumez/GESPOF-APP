<?php

declare(strict_types=1);

namespace App\Module\ServicePrevision\Repository;

use App\Module\ServicePrevision\Entite\FicheExecution\FicheExecution;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<FicheExecution>
 */
class FicheExecutionRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, FicheExecution::class);
    }

    /** Fiche d'exécution liée à une journée (via la FK côté journée). */
    public function trouverParJourneeReference(string $referenceJournee): ?FicheExecution
    {
        return $this->createQueryBuilder('f')
            ->innerJoin('App\Module\ServicePrevision\Entite\JourneeTresorerie\JourneeTresorerie', 'j', 'WITH', 'j.ficheExecution = f')
            ->andWhere('j.reference = :ref')
            ->setParameter('ref', $referenceJournee)
            ->setMaxResults(1)
            ->getQuery()
            ->getOneOrNullResult();
    }

    /** Prochain incrément journalier pour genererReference() (1 si aucune fiche ce jour). */
    public function prochainIncrementPourDate(\DateTimeInterface $date): int
    {
        $prefixe = sprintf('FE-%s-', $date->format('d-m-Y'));

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

    public function save(FicheExecution $fiche, bool $flush = false): void
    {
        $this->getEntityManager()->persist($fiche);
        if ($flush) {
            $this->getEntityManager()->flush();
        }
    }

    public function remove(FicheExecution $fiche, bool $flush = false): void
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
