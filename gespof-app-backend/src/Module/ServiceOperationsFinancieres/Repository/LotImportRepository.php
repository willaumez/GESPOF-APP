<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Repository;

use App\Module\ServiceOperationsFinancieres\Entite\Import\LotImport;
use App\Module\ServiceOperationsFinancieres\Enum\FormatImport;
use App\Module\ServiceOperationsFinancieres\Enum\StatutLotImport;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<LotImport>
 */
class LotImportRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, LotImport::class);
    }

    /**
     * @return list<LotImport>
     */
    public function lister(?int $periodeId = null, ?StatutLotImport $statut = null): array
    {
        $qb = $this->createQueryBuilder('l')
            ->leftJoin('l.periode', 'p')->addSelect('p')
            ->leftJoin('l.importePar', 'u')->addSelect('u')
            ->orderBy('l.importeLe', 'DESC')
            ->addOrderBy('l.id', 'DESC');

        if ($periodeId !== null) {
            $qb->andWhere('p.id = :periodeId')->setParameter('periodeId', $periodeId);
        }
        if ($statut instanceof StatutLotImport) {
            $qb->andWhere('l.statut = :statut')->setParameter('statut', $statut);
        }

        /** @var list<LotImport> $lots */
        $lots = $qb->getQuery()->getResult();

        return $lots;
    }

    /**
     * Lot ACTIF concurrent (même période, format, paramètres).
     *
     * @param array<string, mixed> $parametres
     */
    public function trouverActif(
        int $periodeId,
        FormatImport $format,
        array $parametres,
    ): ?LotImport {
        /** @var list<LotImport> $candidats */
        $candidats = $this->createQueryBuilder('l')
            ->andWhere('l.periode = :periodeId')
            ->andWhere('l.format = :format')
            ->andWhere('l.statut = :actif')
            ->setParameter('periodeId', $periodeId)
            ->setParameter('format', $format)
            ->setParameter('actif', StatutLotImport::ACTIF)
            ->getQuery()
            ->getResult();

        foreach ($candidats as $lot) {
            if ($this->parametresEgaux($lot->getParametres(), $parametres)) {
                return $lot;
            }
        }

        return null;
    }

    /**
     * @param array<string, mixed> $a
     * @param array<string, mixed> $b
     */
    private function parametresEgaux(array $a, array $b): bool
    {
        return json_encode($this->trier($a), JSON_UNESCAPED_UNICODE)
            === json_encode($this->trier($b), JSON_UNESCAPED_UNICODE);
    }

    /**
     * @param array<string, mixed> $arr
     *
     * @return array<string, mixed>
     */
    private function trier(array $arr): array
    {
        ksort($arr);
        foreach ($arr as $k => $v) {
            if (is_array($v)) {
                /** @var array<string, mixed> $v */
                $arr[$k] = $this->trier($v);
            }
        }

        return $arr;
    }
}
