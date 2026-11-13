<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Repository;

use App\Module\ServiceOperationsFinancieres\Entite\Exercice;
use App\Module\ServiceOperationsFinancieres\Enum\StatutExercice;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<Exercice>
 */
class ExerciceRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, Exercice::class);
    }

    public function findByAnnee(int $annee): ?Exercice
    {
        return $this->find($annee);
    }

    /**
     * @return list<Exercice>
     */
    public function listerParAnneeDesc(): array
    {
        /** @var list<Exercice> $exercices */
        $exercices = $this->createQueryBuilder('e')
            ->orderBy('e.annee', 'DESC')
            ->getQuery()
            ->getResult();

        return $exercices;
    }

    /** Exercice ouvert le plus récent, sinon le plus récent tout statut. */
    public function trouverCourant(): ?Exercice
    {
        /** @var Exercice|null $ouvert */
        $ouvert = $this->createQueryBuilder('e')
            ->andWhere('e.statut = :ouvert')
            ->setParameter('ouvert', StatutExercice::OUVERT)
            ->orderBy('e.annee', 'DESC')
            ->setMaxResults(1)
            ->getQuery()
            ->getOneOrNullResult();

        if ($ouvert instanceof Exercice) {
            return $ouvert;
        }

        /** @var Exercice|null $dernier */
        $dernier = $this->createQueryBuilder('e')
            ->orderBy('e.annee', 'DESC')
            ->setMaxResults(1)
            ->getQuery()
            ->getOneOrNullResult();

        return $dernier;
    }
}
