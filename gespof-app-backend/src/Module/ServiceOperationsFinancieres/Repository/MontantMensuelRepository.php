<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Repository;

use App\Module\ServiceOperationsFinancieres\Entite\Referentiel\MontantMensuel;
use App\Module\ServiceOperationsFinancieres\Enum\OrigineMontantMensuel;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<MontantMensuel>
 */
class MontantMensuelRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, MontantMensuel::class);
    }

    public function trouver(
        int $exerciceAnnee,
        string $rubriqueCode,
        int $mois,
        OrigineMontantMensuel $origine,
    ): ?MontantMensuel {
        /** @var MontantMensuel|null $m */
        $m = $this->findOneBy([
            'exerciceAnnee' => $exerciceAnnee,
            'rubriqueCode' => $rubriqueCode,
            'mois' => $mois,
            'origine' => $origine,
        ]);

        return $m;
    }

    /**
     * @return list<MontantMensuel>
     */
    public function listerParExercice(int $exerciceAnnee, ?OrigineMontantMensuel $origine = null): array
    {
        $qb = $this->createQueryBuilder('m')
            ->andWhere('m.exerciceAnnee = :annee')
            ->setParameter('annee', $exerciceAnnee)
            ->orderBy('m.rubriqueCode', 'ASC')
            ->addOrderBy('m.mois', 'ASC');

        if ($origine instanceof OrigineMontantMensuel) {
            $qb->andWhere('m.origine = :origine')->setParameter('origine', $origine);
        }

        /** @var list<MontantMensuel> $rows */
        $rows = $qb->getQuery()->getResult();

        return $rows;
    }

    public function supprimerParExerciceEtOrigine(int $exerciceAnnee, OrigineMontantMensuel $origine): int
    {
        return $this->createQueryBuilder('m')
            ->delete()
            ->andWhere('m.exerciceAnnee = :annee')
            ->andWhere('m.origine = :origine')
            ->setParameter('annee', $exerciceAnnee)
            ->setParameter('origine', $origine)
            ->getQuery()
            ->execute();
    }
}
