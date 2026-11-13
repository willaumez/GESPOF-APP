<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Repository;

use App\Module\ServiceOperationsFinancieres\Entite\Referentiel\Grille;
use App\Module\ServiceOperationsFinancieres\Enum\TypeGrille;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<Grille>
 */
class GrilleRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, Grille::class);
    }

    public function trouver(int $exerciceAnnee, TypeGrille $type): ?Grille
    {
        /** @var Grille|null $g */
        $g = $this->findOneBy(['exerciceAnnee' => $exerciceAnnee, 'type' => $type]);

        return $g;
    }

    /**
     * @return list<Grille>
     */
    public function listerParExercice(int $exerciceAnnee): array
    {
        /** @var list<Grille> $rows */
        $rows = $this->createQueryBuilder('g')
            ->andWhere('g.exerciceAnnee = :annee')
            ->setParameter('annee', $exerciceAnnee)
            ->orderBy('g.type', 'ASC')
            ->getQuery()
            ->getResult();

        return $rows;
    }
}
