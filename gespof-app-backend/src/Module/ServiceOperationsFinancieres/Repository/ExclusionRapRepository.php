<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Repository;

use App\Module\ServiceOperationsFinancieres\Entite\Referentiel\ExclusionRap;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<ExclusionRap>
 */
class ExclusionRapRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, ExclusionRap::class);
    }

    /**
     * Liste ORDONNANCE / MDR uniquement (NATURE retiré du modèle — ni manuel ni code).
     *
     * @return list<ExclusionRap>
     */
    public function lister(?string $type = null): array
    {
        $qb = $this->createQueryBuilder('e')
            ->andWhere('e.type IN (:types)')
            ->setParameter('types', ['ORDONNANCE', 'MDR'])
            ->orderBy('e.type', 'ASC')
            ->addOrderBy('e.code', 'ASC');
        if ($type !== null && $type !== '') {
            $normalise = strtoupper(trim($type));
            if (!in_array($normalise, ['ORDONNANCE', 'MDR'], true)) {
                return [];
            }
            $qb->andWhere('e.type = :type')->setParameter('type', $normalise);
        }

        return $qb->getQuery()->getResult();
    }
}
