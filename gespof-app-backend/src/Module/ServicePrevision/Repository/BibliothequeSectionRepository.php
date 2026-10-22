<?php

declare(strict_types=1);

namespace App\Module\ServicePrevision\Repository;

use App\Module\ServicePrevision\Entite\FicheBleu\BibliothequeSection;
use App\Module\ServicePrevision\Enum\TypeSection;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

class BibliothequeSectionRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, BibliothequeSection::class);
    }

    /**
     * Sections racines de la bibliothèque (sans parente), avec leurs
     * sous-sections accessibles via BibliothequeSection::getSousSections().
     *
     * @return BibliothequeSection[]
     */
    public function listerRacines(): array
    {
        return $this->createQueryBuilder('s')
            ->where('s.sectionParente IS NULL')
            ->orderBy('s.ordre', 'ASC')
            ->addOrderBy('s.id', 'ASC')
            ->getQuery()
            ->getResult();
    }

    public function trouverRacineParLibelleEtType(string $libelle, TypeSection $type): ?BibliothequeSection
    {
        return $this->createQueryBuilder('s')
            ->where('s.sectionParente IS NULL')
            ->andWhere('s.libelle = :libelle')
            ->andWhere('s.type = :type')
            ->setParameter('libelle', $libelle)
            ->setParameter('type', $type)
            ->setMaxResults(1)
            ->getQuery()
            ->getOneOrNullResult();
    }

    public function save(BibliothequeSection $section, bool $flush = false): void
    {
        $this->getEntityManager()->persist($section);
        if ($flush) {
            $this->getEntityManager()->flush();
        }
    }

    public function remove(BibliothequeSection $section, bool $flush = false): void
    {
        $this->getEntityManager()->remove($section);
        if ($flush) {
            $this->getEntityManager()->flush();
        }
    }

    public function flush(): void
    {
        $this->getEntityManager()->flush();
    }
}
