<?php

declare(strict_types=1);

namespace App\Module\ServiceReglement\Repository;

use App\Module\ServiceReglement\Entite\FicheDepot;
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

    /**
     * @return list<string>
     */
    public function referencesParFicheBleue(int $ficheBleueId): array
    {
        /** @var list<string> $references */
        $references = $this->createQueryBuilder('f')
            ->select('f.reference')
            ->andWhere('f.ficheBleue = :id')
            ->setParameter('id', $ficheBleueId)
            ->getQuery()
            ->getSingleColumnResult();

        return $references;
    }

    /**
     * @param list<int> $ids
     *
     * @return array<int, int> ficheBleueId => nombre de fiches de dépôt
     */
    public function compterParFicheBleueIds(array $ids): array
    {
        if ($ids === []) {
            return [];
        }

        $rows = $this->createQueryBuilder('f')
            ->select('IDENTITY(f.ficheBleue) AS fiche_bleue_id, COUNT(f.reference) AS nb')
            ->andWhere('f.ficheBleue IN (:ids)')
            ->setParameter('ids', $ids)
            ->groupBy('f.ficheBleue')
            ->getQuery()
            ->getArrayResult();

        $resultat = [];
        foreach ($rows as $row) {
            $resultat[(int) $row['fiche_bleue_id']] = (int) $row['nb'];
        }

        return $resultat;
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
