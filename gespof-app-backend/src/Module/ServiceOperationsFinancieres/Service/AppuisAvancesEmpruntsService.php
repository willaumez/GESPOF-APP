<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Service;

use App\Module\ServiceOperationsFinancieres\Entite\Periode;
use App\Module\ServiceOperationsFinancieres\Entite\Referentiel\LigneFlechee;
use App\Module\ServiceOperationsFinancieres\Enum\OrigineMontantMensuel;
use App\Module\ServiceOperationsFinancieres\Repository\LigneFlecheeRepository;
use App\Module\ServiceOperationsFinancieres\Repository\MontantMensuelRepository;
use App\Module\ServiceOperationsFinancieres\Repository\PeriodeRepository;
use App\Module\ServiceOperationsFinancieres\Support\AppuisEmpruntsCorrespondance;
use App\Shared\Exception\DonneesInvalidesException;
use Doctrine\ORM\EntityManagerInterface;

/**
 * Recettes › Appuis, avances et emprunts — SPEC §5.6.
 * Lit les CodeM depuis montant_mensuel (AUTO/MANUEL) et reporte vers les codes SROT recettes.
 */
class AppuisAvancesEmpruntsService
{
    private const SOURCE = 'appuis_emprunts';

    public function __construct(
        private readonly PeriodeRepository $periodeRepository,
        private readonly MontantMensuelRepository $montantMensuelRepository,
        private readonly LigneFlecheeRepository $ligneFlecheeRepository,
        private readonly RdModelCumulService $rdModelCumulService,
        private readonly EntityManagerInterface $em,
    ) {
    }

    /**
     * @return array<string, mixed>
     */
    public function obtenir(?int $periodeId = null): array
    {
        [$annee, $mois, $periode] = $this->resoudre($periodeId);
        $index = $this->indexMontants($annee);

        $lignes = [];
        foreach (AppuisEmpruntsCorrespondance::lignes() as $def) {
            $parMois = $index[$def['code_m']] ?? array_fill(1, 12, '0.00');
            $moisVals = [];
            $total = '0.00';
            for ($m = 1; $m <= 12; ++$m) {
                $v = $parMois[$m] ?? '0.00';
                $moisVals[] = $v;
                if ($m <= $mois) {
                    $total = bcadd($total, $v, 2);
                }
            }
            $lignes[] = [
                'code_m' => $def['code_m'],
                'code_srot' => $def['code_srot'],
                'libelle' => $def['libelle'],
                'sens' => $def['sens'],
                'mois' => $moisVals,
                'montant_mois' => $parMois[$mois] ?? '0.00',
                'cumul' => $total,
            ];
        }

        return [
            'periode' => $periode !== null ? [
                'id' => $periode->getId(),
                'exercice_annee' => $annee,
                'mois' => $mois,
            ] : null,
            'exercice' => $annee,
            'mois' => $mois,
            'lignes' => $lignes,
            'message' => 'Sources = montant_mensuel des CodeM (dépenses manuelles). Recalcul reporte les recettes vers les codes SROT.',
        ];
    }

    /**
     * Reporte CodeM → codes SROT recettes dans ligne_flechee, puis reconstruit cumul AUTO.
     *
     * @return array<string, mixed>
     */
    public function recalculer(?int $periodeId = null): array
    {
        [$annee, $mois, $periode] = $this->resoudre($periodeId);
        if ($periode === null || $periode->getId() === null) {
            throw new DonneesInvalidesException('Aucune période SROT.');
        }

        $periodes = $this->periodeRepository->listerParExercice($annee);
        $periodesParMois = [];
        foreach ($periodes as $p) {
            if ($p->getId() !== null) {
                $this->ligneFlecheeRepository->supprimerParPeriodeEtSource($p->getId(), self::SOURCE);
                $periodesParMois[$p->getMois()] = $p;
            }
        }
        $this->em->flush();

        $index = $this->indexMontants($annee);
        $map = AppuisEmpruntsCorrespondance::mapRecettes();
        $nb = 0;
        foreach ($map as $codeM => $codeSrot) {
            $parMois = $index[$codeM] ?? [];
            foreach ($parMois as $m => $montant) {
                if ($m < 1 || $m > 12 || 0 === bccomp($montant, '0.00', 2)) {
                    continue;
                }
                $cible = $periodesParMois[$m] ?? $periode;
                $this->em->persist(new LigneFlechee(
                    self::SOURCE,
                    $codeSrot.'-'.$m,
                    $cible,
                    $codeSrot,
                    $m,
                    $montant,
                ));
                ++$nb;
            }
        }
        $this->em->flush();
        $cumul = $this->rdModelCumulService->recalculerAuto($annee);

        return [
            'nb_lignes' => $nb,
            'cumul' => $cumul,
            'etat' => $this->obtenir($periode->getId()),
        ];
    }

    /**
     * @return array<string, array<int, string>>
     */
    private function indexMontants(int $annee): array
    {
        $out = [];
        foreach ($this->montantMensuelRepository->listerParExercice($annee) as $m) {
            // AUTO + MANUEL (pas AJUSTEMENT) pour les CodeM.
            if ($m->getOrigine() === OrigineMontantMensuel::AJUSTEMENT) {
                continue;
            }
            $code = $m->getRubriqueCode();
            $mois = $m->getMois();
            $out[$code][$mois] = bcadd($out[$code][$mois] ?? '0.00', $m->getMontant(), 2);
        }

        return $out;
    }

    /**
     * @return array{0: int, 1: int, 2: ?Periode}
     */
    private function resoudre(?int $periodeId): array
    {
        if ($periodeId !== null && $periodeId > 0) {
            $p = $this->periodeRepository->find($periodeId);
            if ($p instanceof Periode) {
                return [$p->getExercice()->getAnnee(), $p->getMois(), $p];
            }
        }
        /** @var list<Periode> $periodes */
        $periodes = $this->periodeRepository->createQueryBuilder('p')
            ->leftJoin('p.exercice', 'e')->addSelect('e')
            ->orderBy('e.annee', 'DESC')->addOrderBy('p.mois', 'DESC')
            ->setMaxResults(1)->getQuery()->getResult();
        $p = $periodes[0] ?? null;
        if (!$p instanceof Periode) {
            return [(int) date('Y'), (int) date('n'), null];
        }

        return [$p->getExercice()->getAnnee(), $p->getMois(), $p];
    }
}
