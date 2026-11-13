<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Repository;

use App\Module\ServiceOperationsFinancieres\Entite\Referentiel\HorsSrotValeur;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/** @extends ServiceEntityRepository<HorsSrotValeur> */
class HorsSrotValeurRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, HorsSrotValeur::class);
    }

    /**
     * @return list<HorsSrotValeur>
     */
    public function lister(int $exerciceAnnee, ?int $mois = null): array
    {
        $qb = $this->createQueryBuilder('h')
            ->andWhere('h.exerciceAnnee = :a')
            ->setParameter('a', $exerciceAnnee)
            ->orderBy('h.mois', 'ASC')
            ->addOrderBy('h.code', 'ASC');
        if ($mois !== null) {
            $qb->andWhere('h.mois = :m OR h.mois = 0')->setParameter('m', $mois);
        }

        /** @var list<HorsSrotValeur> $rows */
        $rows = $qb->getQuery()->getResult();

        return $rows;
    }

    public function trouver(int $exerciceAnnee, int $mois, string $code): ?HorsSrotValeur
    {
        return $this->findOneBy([
            'exerciceAnnee' => $exerciceAnnee,
            'mois' => $mois,
            'code' => $code,
        ]);
    }
}
