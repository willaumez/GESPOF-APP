<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Repository;

use App\Module\ServiceOperationsFinancieres\Entite\Referentiel\FicheDepotLigne;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<FicheDepotLigne>
 */
class FicheDepotLigneRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, FicheDepotLigne::class);
    }

    /**
     * @return list<FicheDepotLigne>
     */
    public function listerParExercice(int $exerciceAnnee): array
    {
        /** @var list<FicheDepotLigne> $rows */
        $rows = $this->createQueryBuilder('f')
            ->andWhere('f.exerciceAnnee = :a')
            ->setParameter('a', $exerciceAnnee)
            ->orderBy('f.ordre', 'ASC')
            ->addOrderBy('f.code', 'ASC')
            ->getQuery()
            ->getResult();

        return $rows;
    }

    public function trouverParExerciceEtCode(int $exerciceAnnee, string $code): ?FicheDepotLigne
    {
        return $this->findOneBy(['exerciceAnnee' => $exerciceAnnee, 'code' => $code]);
    }
}
