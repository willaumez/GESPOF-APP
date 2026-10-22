<?php

declare(strict_types=1);

namespace App\Module\ServicePrevision\Repository;

use App\Module\ServicePrevision\Entite\FicheExecutionConso\ConsoRubrique;
use App\Module\ServicePrevision\Enum\TypeSection;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

class ConsoRubriqueRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, ConsoRubrique::class);
    }

    /**
     * @return list<ConsoRubrique>
     */
    public function listerRacines(): array
    {
        /** @var list<ConsoRubrique> $racines */
        $racines = $this->createQueryBuilder('r')
            ->where('r.parent IS NULL')
            ->orderBy('r.ordre', 'ASC')
            ->addOrderBy('r.id', 'ASC')
            ->getQuery()
            ->getResult();

        return $racines;
    }

    public function trouverParCle(string $cle): ?ConsoRubrique
    {
        return $this->findOneBy(['cle' => $cle]);
    }

    public function trouverRacineParType(TypeSection $type): ?ConsoRubrique
    {
        return $this->createQueryBuilder('r')
            ->where('r.parent IS NULL')
            ->andWhere('r.type = :type')
            ->setParameter('type', $type)
            ->orderBy('r.ordre', 'ASC')
            ->setMaxResults(1)
            ->getQuery()
            ->getOneOrNullResult();
    }

    public function compterRacines(): int
    {
        return (int) $this->createQueryBuilder('r')
            ->select('COUNT(r.id)')
            ->where('r.parent IS NULL')
            ->getQuery()
            ->getSingleScalarResult();
    }

    /**
     * Promet les enfants du conteneur au parent de celui-ci (ou à la racine)
     * puis supprime le conteneur. SQL brut pour contourner orphanRemoval.
     */
    public function promouvoirEnfantsEtSupprimerConteneur(int $conteneurId, ?int $nouveauParentId): void
    {
        $conn = $this->getEntityManager()->getConnection();
        if ($nouveauParentId === null) {
            $conn->executeStatement(
                'UPDATE conso_rubrique SET parent_id = NULL WHERE parent_id = ?',
                [$conteneurId],
            );
        } else {
            $conn->executeStatement(
                'UPDATE conso_rubrique SET parent_id = ? WHERE parent_id = ?',
                [$nouveauParentId, $conteneurId],
            );
        }
        $conn->executeStatement(
            'DELETE FROM conso_valeur_jour WHERE rubrique_id = ?',
            [$conteneurId],
        );
        $conn->executeStatement(
            'DELETE FROM conso_rubrique WHERE id = ?',
            [$conteneurId],
        );
    }

    public function viderCache(): void
    {
        $this->getEntityManager()->clear();
    }

    public function save(ConsoRubrique $rubrique, bool $flush = false): void
    {
        $this->getEntityManager()->persist($rubrique);
        if ($flush) {
            $this->getEntityManager()->flush();
        }
    }

    public function flush(): void
    {
        $this->getEntityManager()->flush();
    }
}
