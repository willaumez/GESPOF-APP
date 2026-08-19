<?php

declare(strict_types=1);

namespace App\Module\ServicePrevision\Repository;

use App\Module\ServicePrevision\Entite\FicheBleu\FicheBleueModele;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

class FicheBleueModeleRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, FicheBleueModele::class);
    }

    /**
     * @return FicheBleueModele[]
     */
    public function listerOrdonne(?string $recherche = null): array
    {
        $qb = $this->createQueryBuilder('m')
            ->orderBy('m.nom', 'ASC');

        if ($recherche !== null && $recherche !== '') {
            $qb->andWhere('LOWER(m.nom) LIKE :recherche OR LOWER(m.description) LIKE :recherche')
                ->setParameter('recherche', '%'.mb_strtolower($recherche).'%');
        }

        return $qb->getQuery()->getResult();
    }

    public function retirerDefautSauf(?int $idAConserver): void
    {
        $qb = $this->createQueryBuilder('m')
            ->update()
            ->set('m.estParDefaut', 'false')
            ->where('m.estParDefaut = true');

        if ($idAConserver !== null) {
            $qb->andWhere('m.id != :id')->setParameter('id', $idAConserver);
        }

        $qb->getQuery()->execute();
    }

    public function save(FicheBleueModele $modele, bool $flush = false): void
    {
        $this->getEntityManager()->persist($modele);
        if ($flush) {
            $this->getEntityManager()->flush();
        }
    }

    public function remove(FicheBleueModele $modele, bool $flush = false): void
    {
        $this->getEntityManager()->remove($modele);
        if ($flush) {
            $this->getEntityManager()->flush();
        }
    }

    public function flush(): void
    {
        $this->getEntityManager()->flush();
    }
}
