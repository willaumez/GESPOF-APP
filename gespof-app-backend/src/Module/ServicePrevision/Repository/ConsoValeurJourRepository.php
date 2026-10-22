<?php

declare(strict_types=1);

namespace App\Module\ServicePrevision\Repository;

use App\Module\ServicePrevision\Entite\FicheExecutionConso\ConsoRubrique;
use App\Module\ServicePrevision\Entite\FicheExecutionConso\ConsoValeurJour;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

class ConsoValeurJourRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, ConsoValeurJour::class);
    }

    public function trouverPourRubriqueEtDate(
        ConsoRubrique $rubrique,
        \DateTimeImmutable $date,
    ): ?ConsoValeurJour {
        return $this->findOneBy([
            'rubrique' => $rubrique,
            'dateJour' => $date,
        ]);
    }

    /**
     * Dates distinctes déjà consolidées (une entrée par journée clôturée).
     *
     * @return list<\DateTimeImmutable>
     */
    public function listerDatesDistinctes(): array
    {
        $lignes = $this->createQueryBuilder('v')
            ->select('v.dateJour AS dateJour')
            ->distinct()
            ->orderBy('v.dateJour', 'DESC')
            ->getQuery()
            ->getArrayResult();

        $dates = [];
        foreach ($lignes as $ligne) {
            $brut = $ligne['dateJour'] ?? null;
            if ($brut instanceof \DateTimeInterface) {
                $dates[] = \DateTimeImmutable::createFromInterface($brut)->setTime(0, 0);
            } elseif (is_string($brut) && $brut !== '') {
                $dates[] = (new \DateTimeImmutable($brut))->setTime(0, 0);
            }
        }

        return $dates;
    }

    /**
     * @return list<ConsoValeurJour>
     */
    public function listerEntreDates(\DateTimeImmutable $debut, \DateTimeImmutable $fin): array
    {
        /** @var list<ConsoValeurJour> $valeurs */
        $valeurs = $this->createQueryBuilder('v')
            ->andWhere('v.dateJour >= :debut')
            ->andWhere('v.dateJour <= :fin')
            ->setParameter('debut', $debut)
            ->setParameter('fin', $fin)
            ->getQuery()
            ->getResult();

        return $valeurs;
    }

    public function supprimerPourJournee(string $reference): int
    {
        return $this->createQueryBuilder('v')
            ->delete()
            ->where('v.journeeReference = :ref')
            ->setParameter('ref', $reference)
            ->getQuery()
            ->execute();
    }

    public function save(ConsoValeurJour $valeur, bool $flush = false): void
    {
        $this->getEntityManager()->persist($valeur);
        if ($flush) {
            $this->getEntityManager()->flush();
        }
    }

    public function flush(): void
    {
        $this->getEntityManager()->flush();
    }
}
