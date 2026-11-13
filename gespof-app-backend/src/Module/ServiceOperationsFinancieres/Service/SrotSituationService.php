<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Service;

use App\Module\ServiceOperationsFinancieres\Entite\Exercice;
use App\Module\ServiceOperationsFinancieres\Entite\Periode;
use App\Module\ServiceOperationsFinancieres\Enum\StatutPeriode;
use App\Module\ServiceOperationsFinancieres\Enum\TypeLoiFinances;
use App\Module\ServiceOperationsFinancieres\Repository\ExerciceRepository;
use App\Module\ServiceOperationsFinancieres\Repository\LoiFinancesRepository;
use App\Module\ServiceOperationsFinancieres\Repository\MontantMensuelRepository;
use App\Module\ServiceOperationsFinancieres\Repository\PeriodeRepository;
use App\Module\ServiceOperationsFinancieres\Repository\SrotArchiveRepository;
use App\Module\ServiceOperationsFinancieres\Support\SrotAgregats;
use App\Shared\Exception\DonneesInvalidesException;

/**
 * Situation résumée / soldes / équilibre — SPEC §8.2–§8.4 (Lot 6).
 * Mois ouvert : recalcul depuis montant_mensuel consolidé (AUTO+MANUEL+AJUSTEMENT).
 * Mois validé/publié : lecture archive srot_archive (Lot 7).
 */
class SrotSituationService
{
    public function __construct(
        private readonly MontantMensuelRepository $montantMensuelRepository,
        private readonly PeriodeRepository $periodeRepository,
        private readonly ExerciceRepository $exerciceRepository,
        private readonly FicheDepotsService $ficheDepotsService,
        private readonly LoiFinancesRepository $loiFinancesRepository,
        private readonly SrotArchiveRepository $srotArchiveRepository,
    ) {
    }

    /**
     * @return array<string, mixed>
     */
    public function situation(?int $periodeId = null): array
    {
        [$periode, $annee, $mois] = $this->contexte($periodeId);

        if (in_array($periode->getStatut(), [StatutPeriode::VALIDEE, StatutPeriode::PUBLIEE], true)) {
            $archive = $this->lireArchive($annee, $mois);
            if ($archive !== null) {
                return [
                    'periode' => [
                        'id' => $periode->getId(),
                        'exercice_annee' => $annee,
                        'mois' => $mois,
                        'statut' => $periode->getStatut()->value,
                    ],
                    'origine' => 'ARCHIVE',
                    'mode' => 'archive',
                    'note' => 'Mois validé : valeurs lues dans srot_archive (SPEC §8.2).',
                    'lignes' => $archive,
                    'disponibilites' => $this->ficheDepotsService->disponibilites($annee),
                ];
            }
        }

        $index = $this->indexConsolide($annee);
        /** @var Exercice $exercice */
        $exercice = $this->exerciceRepository->find($annee);
        $balance = $exercice?->getBalanceInitiale() ?? '0.00';

        $s = static fn (array $codes, bool $cumul): string => SrotAgregats::somme($index, $codes, $mois, $cumul);
        $sPrec = static fn (array $codes): string => $mois <= 1
            ? '0.00'
            : SrotAgregats::somme($index, $codes, $mois - 1, true);

        $petroleC = $s(SrotAgregats::codesPetrole(), true);
        $petroleM = $s(SrotAgregats::codesPetrole(), false);
        $petroleP = $sPrec(SrotAgregats::codesPetrole());

        $fiscC = SrotAgregats::add(
            $s(SrotAgregats::codesDouanes(), true),
            $s(SrotAgregats::codesFiscalesHorsDouanes(), true),
        );
        $fiscM = SrotAgregats::add(
            $s(SrotAgregats::codesDouanes(), false),
            $s(SrotAgregats::codesFiscalesHorsDouanes(), false),
        );
        $fiscP = SrotAgregats::add(
            $sPrec(SrotAgregats::codesDouanes()),
            $sPrec(SrotAgregats::codesFiscalesHorsDouanes()),
        );

        $nfC = $s(SrotAgregats::codesNonFiscales(), true);
        $nfM = $s(SrotAgregats::codesNonFiscales(), false);
        $nfP = $sPrec(SrotAgregats::codesNonFiscales());

        $cotC = $s(SrotAgregats::codesCotisationsSociales(), true);
        $cotM = $s(SrotAgregats::codesCotisationsSociales(), false);
        $cotP = $sPrec(SrotAgregats::codesCotisationsSociales());

        // B = fiscales + non fiscales + cotisations + autres (pétrole hors RB fiscales)
        // SPEC : RB brutes = fiscales + non fiscales + cotisations + autres ; pétrole traité à part en maquette
        $rbC = SrotAgregats::add(SrotAgregats::add($fiscC, $nfC), $cotC);
        $rbM = SrotAgregats::add(SrotAgregats::add($fiscM, $nfM), $cotM);
        $rbP = SrotAgregats::add(SrotAgregats::add($fiscP, $nfP), $cotP);
        // Inclure pétrole dans B budgétaires brutes
        $bC = SrotAgregats::add($rbC, $petroleC);
        $bM = SrotAgregats::add($rbM, $petroleM);
        $bP = SrotAgregats::add($rbP, $petroleP);

        $antC = $s(SrotAgregats::codesDepensesAnt(), true);
        $antM = $s(SrotAgregats::codesDepensesAnt(), false);
        $antP = $sPrec(SrotAgregats::codesDepensesAnt());

        $courC = $s(SrotAgregats::codesDepensesCourantBudgetaires(), true);
        $courM = $s(SrotAgregats::codesDepensesCourantBudgetaires(), false);
        $courP = $sPrec(SrotAgregats::codesDepensesCourantBudgetaires());

        $cC = SrotAgregats::add($antC, $courC);
        $cM = SrotAgregats::add($antM, $courM);
        $cP = SrotAgregats::add($antP, $courP);

        // D dépenses nettes de trésorerie (approximation codes sans ordonnancement clés)
        $dCodes = array_merge(
            SrotAgregats::codesCapitalDetteExt(),
            SrotAgregats::codesCapitalDetteInt(),
            SrotAgregats::codesRemboursementsBta(),
            SrotAgregats::codesRemboursementsFacilites(),
            SrotAgregats::codesRemboursementsDts(),
            ['AL', 'AM', 'AN', 'AO', 'AO1', 'AO2', 'AO3', 'AP', 'AQ', 'AR', 'AS', 'AT', 'AU', 'AV', 'AW', 'AX', 'AY'],
        );
        $tvaRembC = $s(SrotAgregats::codesTvaRemboursements(), true);
        $tvaRembM = $s(SrotAgregats::codesTvaRemboursements(), false);
        $tvaRembP = $sPrec(SrotAgregats::codesTvaRemboursements());
        // D ≈ sans-ordo − remboursements TVA (recettes) ; SPEC D85 − R91 − … + R23 + R24
        // Approximation SPEC D : sans-ordonnancement + remboursements TVA (R23+R24).
        $dC = SrotAgregats::add($s($dCodes, true), $tvaRembC);
        $dM = SrotAgregats::add($s($dCodes, false), $tvaRembM);
        $dP = SrotAgregats::add($sPrec($dCodes), $tvaRembP);

        $aC = $balance; // cumul à date balance (millions côté Excel ; ici FCFA)
        $aM = $mois === 1 ? $balance : '0.00';
        $aP = $mois === 1 ? '0.00' : $balance;

        $eC = SrotAgregats::sub(SrotAgregats::sub(SrotAgregats::add($aC, $bC), $cC), $dC);
        $eM = SrotAgregats::sub(SrotAgregats::sub(SrotAgregats::add($aM, $bM), $cM), $dM);
        $eP = SrotAgregats::sub(SrotAgregats::sub(SrotAgregats::add($aP, $bP), $cP), $dP);

        $finCodes = SrotAgregats::codesEmpruntsFinancement();
        $fC = $s($finCodes, true);
        $fM = $s($finCodes, false);
        $fP = $sPrec($finCodes);
        // Financement net ≈ emprunts − remboursements BTA/facil/DTS
        $fC = SrotAgregats::sub(
            $fC,
            SrotAgregats::add(
                SrotAgregats::add(
                    $s(SrotAgregats::codesRemboursementsBta(), true),
                    $s(SrotAgregats::codesRemboursementsFacilites(), true),
                ),
                $s(SrotAgregats::codesRemboursementsDts(), true),
            ),
        );
        $fM = SrotAgregats::sub(
            $fM,
            SrotAgregats::add(
                SrotAgregats::add(
                    $s(SrotAgregats::codesRemboursementsBta(), false),
                    $s(SrotAgregats::codesRemboursementsFacilites(), false),
                ),
                $s(SrotAgregats::codesRemboursementsDts(), false),
            ),
        );
        $fP = SrotAgregats::sub(
            $fP,
            SrotAgregats::add(
                SrotAgregats::add(
                    $sPrec(SrotAgregats::codesRemboursementsBta()),
                    $sPrec(SrotAgregats::codesRemboursementsFacilites()),
                ),
                $sPrec(SrotAgregats::codesRemboursementsDts()),
            ),
        );

        $gC = SrotAgregats::add($eC, $fC);
        $gM = SrotAgregats::add($eM, $fM);
        $gP = SrotAgregats::add($eP, $fP);

        $dispo = $this->ficheDepotsService->disponibilites($annee);
        $hC = SrotAgregats::add($dispo['total_disponibilites'], $dispo['tresorerie_oisive']);
        $hM = '0.00';
        $hP = $hC;

        $iC = SrotAgregats::sub($hC, $gC);
        $iM = SrotAgregats::sub($hM, $gM);
        $iP = SrotAgregats::sub($hP, $gP);

        $jC = SrotAgregats::add(SrotAgregats::sub($gC, $hC), $iC);
        $jM = SrotAgregats::add(SrotAgregats::sub($gM, $hM), $iM);
        $jP = SrotAgregats::add(SrotAgregats::sub($gP, $hP), $iP);

        $pack = static function (string $id, string $lib, string $p, string $m, string $c, int $niv = 0, bool $sec = false): array {
            return [
                'id' => $id,
                'libelle' => $lib,
                'niveau' => $niv,
                'section' => $sec,
                'cumul_precedent' => $p,
                'mois' => $m,
                'cumul' => $c,
                'millions_cumul_precedent' => SrotAgregats::enMillions($p),
                'millions_mois' => SrotAgregats::enMillions($m),
                'millions_cumul' => SrotAgregats::enMillions($c),
            ];
        };

        $lignes = [
            $pack('A', 'A. Balance d\'entrée', $aP, $aM, $aC, 0, true),
            $pack('B', 'B. Recettes budgétaires brutes', $bP, $bM, $bC, 0, true),
            $pack('B_PET', 'Recettes pétrolières', $petroleP, $petroleM, $petroleC, 1),
            $pack('B_FIS', 'Recettes fiscales', $fiscP, $fiscM, $fiscC, 1),
            $pack('B_NF', 'Recettes non fiscales', $nfP, $nfM, $nfC, 1),
            $pack('B_COT', 'Cotisations sociales', $cotP, $cotM, $cotC, 1),
            $pack('C', 'C. Dépenses budgétaires', $cP, $cM, $cC, 0, true),
            $pack('C_ANT', 'Exercices antérieurs', $antP, $antM, $antC, 1),
            $pack('C_COUR', 'Exercice courant', $courP, $courM, $courC, 1),
            $pack('D', 'D. Dépenses nettes de trésorerie', $dP, $dM, $dC, 0, true),
            $pack('E', 'E. Solde', $eP, $eM, $eC, 0, true),
            $pack('F', 'F. Financement', $fP, $fM, $fC, 0, true),
            $pack('G', 'G. Solde avec financement', $gP, $gM, $gC, 0, true),
            $pack('H', 'H. Solde détaillé (disponibilités + oisive)', $hP, $hM, $hC, 0, true),
            $pack('I', 'I. Opérations en attente', $iP, $iM, $iC, 0, true),
            $pack('J', 'J. Équilibre de trésorerie', $jP, $jM, $jC, 0, true),
        ];

        return [
            'periode' => [
                'id' => $periode->getId(),
                'exercice_annee' => $annee,
                'mois' => $mois,
                'statut' => $periode->getStatut()->value,
            ],
            'origine' => 'AUTO+MANUEL+AJUSTEMENT',
            'mode' => 'ouvert',
            'note' => 'Mois ouvert recalculé (§8.2). Archive mois validés : Lot 7.',
            'lignes' => $lignes,
            'disponibilites' => $dispo,
        ];
    }

    /**
     * Soldes de gestion — SPEC §8.3.
     *
     * @return array<string, mixed>
     */
    public function soldes(?int $periodeId = null): array
    {
        $sit = $this->situation($periodeId);
        $byId = [];
        foreach ($sit['lignes'] as $l) {
            $byId[$l['id']] = $l;
        }
        $get = static fn (string $id, string $col): string => $byId[$id][$col] ?? '0.00';

        $exceptionnellesM = '0.00'; // saisie à venir
        $antM = SrotAgregats::add($get('A', 'mois'), SrotAgregats::sub($exceptionnellesM, $get('C_ANT', 'mois')));
        // exercices antérieurs = ouverture + recettes exceptionnelles − dépenses antérieures
        $antCumul = SrotAgregats::add($get('A', 'cumul'), SrotAgregats::sub($exceptionnellesM, $get('C_ANT', 'cumul')));

        $courM = SrotAgregats::sub(
            SrotAgregats::sub($get('B', 'mois'), $exceptionnellesM),
            $get('C_COUR', 'mois'),
        );
        $courCumul = SrotAgregats::sub(
            SrotAgregats::sub($get('B', 'cumul'), $exceptionnellesM),
            $get('C_COUR', 'cumul'),
        );

        $dntM = $get('D', 'mois');
        $dntC = $get('D', 'cumul');
        $globalM = SrotAgregats::sub(SrotAgregats::add($antM, $courM), $dntM);
        $globalC = SrotAgregats::sub(SrotAgregats::add($antCumul, $courCumul), $dntC);

        $lignes = [
            [
                'id' => 'SG1',
                'libelle' => '1. Soldes exercices antérieurs',
                'mois' => $antM,
                'cumul' => $antCumul,
                '_fw' => 1,
            ],
            [
                'id' => 'SG2',
                'libelle' => '2. Solde exercice courant',
                'mois' => $courM,
                'cumul' => $courCumul,
                '_fw' => 1,
            ],
            [
                'id' => 'SG3',
                'libelle' => '3. Dépenses nettes de trésorerie',
                'mois' => $dntM,
                'cumul' => $dntC,
                '_fw' => 1,
            ],
            [
                'id' => 'SG4',
                'libelle' => '4. Solde global (1 + 2 − 3)',
                'mois' => $globalM,
                'cumul' => $globalC,
                '_fw' => 1,
            ],
            [
                'id' => 'SG5',
                'libelle' => '5. Financement',
                'mois' => $get('F', 'mois'),
                'cumul' => $get('F', 'cumul'),
                '_fw' => 1,
            ],
        ];

        return [
            'periode' => $sit['periode'],
            'lignes' => $lignes,
        ];
    }

    /**
     * Équilibre (exécution mois / cumul) — SPEC §8.4, feuille EQUILIBRE-Titrisation.
     *
     * @return array<string, mixed>
     */
    public function equilibre(?int $periodeId = null): array
    {
        [$periode, $annee, $mois] = $this->contexte($periodeId);
        $index = $this->indexConsolide($annee);
        $s = static fn (array $codes, bool $cumul): string => SrotAgregats::somme($index, $codes, $mois, $cumul);

        $dgi = SrotAgregats::sub(
            SrotAgregats::add(
                $s(SrotAgregats::codesFiscalesHorsDouanes(), false),
                $s(SrotAgregats::codesTvaRemboursements(), false),
            ),
            $s(SrotAgregats::codesCotisationsSociales(), false),
        );
        $dgiC = SrotAgregats::sub(
            SrotAgregats::add(
                $s(SrotAgregats::codesFiscalesHorsDouanes(), true),
                $s(SrotAgregats::codesTvaRemboursements(), true),
            ),
            $s(SrotAgregats::codesCotisationsSociales(), true),
        );

        $rows = [
            ['id' => 'R_DGI', 'libelle' => 'Recettes DGI', 'niveau' => 1, 'ex_m' => $dgi, 'ex_c' => $dgiC],
            ['id' => 'R_DOU', 'libelle' => 'Douanes', 'niveau' => 1, 'ex_m' => $s(SrotAgregats::codesDouanes(), false), 'ex_c' => $s(SrotAgregats::codesDouanes(), true)],
            ['id' => 'R_PET', 'libelle' => 'Pétrole', 'niveau' => 1, 'ex_m' => $s(SrotAgregats::codesPetrole(), false), 'ex_c' => $s(SrotAgregats::codesPetrole(), true)],
            ['id' => 'R_COT', 'libelle' => 'Cotisations sociales', 'niveau' => 1, 'ex_m' => $s(SrotAgregats::codesCotisationsSociales(), false), 'ex_c' => $s(SrotAgregats::codesCotisationsSociales(), true)],
            ['id' => 'R_AFF', 'libelle' => 'Recettes affectées (correspondants)', 'niveau' => 1, 'ex_m' => $s(['AAA'], false), 'ex_c' => $s(['AAA'], true)],
            ['id' => 'SEC_R', 'libelle' => 'Ressources', 'niveau' => 0, 'ex_m' => null, 'ex_c' => null],
            ['id' => 'D_PERS', 'libelle' => 'Personnel', 'niveau' => 1, 'ex_m' => $s(SrotAgregats::codesPersonnelCourant(), false), 'ex_c' => $s(SrotAgregats::codesPersonnelCourant(), true)],
            ['id' => 'D_BS', 'libelle' => 'Biens et services', 'niveau' => 1, 'ex_m' => $s(SrotAgregats::codesBiensServicesCourant(), false), 'ex_c' => $s(SrotAgregats::codesBiensServicesCourant(), true)],
            ['id' => 'D_TR', 'libelle' => 'Transferts', 'niveau' => 1, 'ex_m' => $s(SrotAgregats::codesTransfertsCourant(), false), 'ex_c' => $s(SrotAgregats::codesTransfertsCourant(), true)],
            ['id' => 'D_INV', 'libelle' => 'Investissement, ressources propres', 'niveau' => 1, 'ex_m' => $s(SrotAgregats::codesInvestissementCourant(), false), 'ex_c' => $s(SrotAgregats::codesInvestissementCourant(), true)],
            ['id' => 'D_CF', 'libelle' => 'Charges financières', 'niveau' => 1, 'ex_m' => $s(SrotAgregats::codesInteretsCourant(), false), 'ex_c' => $s(SrotAgregats::codesInteretsCourant(), true)],
            ['id' => 'D_AM_I', 'libelle' => 'Amortissement intérieur', 'niveau' => 1, 'ex_m' => $s(SrotAgregats::codesCapitalDetteInt(), false), 'ex_c' => $s(SrotAgregats::codesCapitalDetteInt(), true)],
            ['id' => 'D_AM_E', 'libelle' => 'Amortissement extérieur', 'niveau' => 1, 'ex_m' => $s(SrotAgregats::codesCapitalDetteExt(), false), 'ex_c' => $s(SrotAgregats::codesCapitalDetteExt(), true)],
            ['id' => 'D_ANT', 'libelle' => 'Dépenses sur exercices antérieurs', 'niveau' => 1, 'ex_m' => $s(SrotAgregats::codesDepensesAnt(), false), 'ex_c' => $s(SrotAgregats::codesDepensesAnt(), true)],
            ['id' => 'D_TVA', 'libelle' => 'Remboursements TVA', 'niveau' => 1, 'ex_m' => $s(SrotAgregats::codesTvaRemboursements(), false), 'ex_c' => $s(SrotAgregats::codesTvaRemboursements(), true)],
            ['id' => 'SEC_C', 'libelle' => 'Charges', 'niveau' => 0, 'ex_m' => null, 'ex_c' => null],
        ];

        $lfiTotal = '0.00';
        $lfrTotal = '0.00';
        foreach ($this->loiFinancesRepository->listerParExercice($annee) as $loi) {
            $sum = '0.00';
            foreach ($loi->getRecettes() as $r) {
                $sum = bcadd($sum, $r->getMontant(), 2);
            }
            foreach ($loi->getDepenses() as $d) {
                $sum = bcadd($sum, $d->getMontant(), 2);
            }
            if ($loi->getType() === TypeLoiFinances::LFI) {
                $lfiTotal = $sum;
            }
            if ($loi->getType() === TypeLoiFinances::LFR) {
                $lfrTotal = $sum;
            }
        }
        if ($lfrTotal === '0.00') {
            $lfrTotal = $lfiTotal;
        }
        $prevMois = $mois > 0 ? bcdiv($lfrTotal, '12', 2) : '0.00';
        $prevCumul = bcmul($prevMois, (string) $mois, 2);

        $lignes = [];
        foreach ($rows as $r) {
            $exM = $r['ex_m'] ?? '0.00';
            $exC = $r['ex_c'] ?? '0.00';
            $estSec = $r['niveau'] === 0;
            $tauxM = (!$estSec && $prevMois !== '0.00' && bccomp($prevMois, '0', 2) !== 0)
                ? bcmul(bcdiv((string) $exM, $prevMois, 6), '100', 2)
                : null;
            $tauxC = (!$estSec && $prevCumul !== '0.00' && bccomp($prevCumul, '0', 2) !== 0)
                ? bcmul(bcdiv((string) $exC, $prevCumul, 6), '100', 2)
                : null;
            $lignes[] = [
                'id' => $r['id'],
                'libelle' => $r['libelle'],
                'niveau' => $r['niveau'],
                'section' => $estSec,
                'lfi' => $estSec ? null : $lfiTotal,
                'lfr' => $estSec ? null : $lfrTotal,
                'prevision' => $estSec ? null : $prevMois,
                'execution' => $estSec ? null : $exM,
                'taux' => $tauxM,
                'prevision_cumulee' => $estSec ? null : $prevCumul,
                'execution_cumulee' => $estSec ? null : $exC,
                'taux_cumule' => $tauxC,
            ];
        }

        return [
            'periode' => [
                'id' => $periode->getId(),
                'exercice_annee' => $annee,
                'mois' => $mois,
                'statut' => $periode->getStatut()->value,
            ],
            'titrisation' => true,
            'note' => 'EQUILIBRE-Titrisation (§8.4). Prévisions mensuelles = LFR/12 (approximation en attendant Prévisions › Recettes).',
            'lignes' => $lignes,
        ];
    }

    /**
     * @return array{0: Periode, 1: int, 2: int}
     */
    private function contexte(?int $periodeId): array
    {
        if ($periodeId !== null && $periodeId > 0) {
            $p = $this->periodeRepository->find($periodeId);
            if ($p === null) {
                throw new DonneesInvalidesException('Période introuvable.');
            }

            return [$p, $p->getExercice()->getAnnee(), $p->getMois()];
        }
        /** @var list<Periode> $periodes */
        $periodes = $this->periodeRepository->createQueryBuilder('p')
            ->leftJoin('p.exercice', 'e')->addSelect('e')
            ->orderBy('e.annee', 'DESC')->addOrderBy('p.mois', 'DESC')
            ->setMaxResults(1)->getQuery()->getResult();
        if ($periodes === []) {
            throw new DonneesInvalidesException('Aucune période SROT.');
        }
        $p = $periodes[0];

        return [$p, $p->getExercice()->getAnnee(), $p->getMois()];
    }

    /**
     * @return array<string, array<int, string>>
     */
    private function indexConsolide(int $annee): array
    {
        $out = [];
        foreach ($this->montantMensuelRepository->listerParExercice($annee) as $m) {
            $code = $m->getRubriqueCode();
            $mois = $m->getMois();
            $out[$code][$mois] = bcadd($out[$code][$mois] ?? '0.00', $m->getMontant(), 2);
        }

        return $out;
    }

    /**
     * @return list<array<string, mixed>>|null
     */
    private function lireArchive(int $exerciceAnnee, int $mois): ?array
    {
        $rows = $this->srotArchiveRepository->listerParExerciceMois($exerciceAnnee, $mois);
        if ($rows === []) {
            return null;
        }
        $out = [];
        foreach ($rows as $a) {
            $out[] = [
                'id' => $a->getLigneSrot(),
                'libelle' => $a->getLibelle(),
                'niveau' => $a->getNiveau(),
                'section' => $a->getNiveau() === 0,
                'cumul_precedent' => '0.00',
                'mois' => $a->getValeurMoisFcfa(),
                'cumul' => $a->getValeurCumulFcfa(),
                'millions_cumul_precedent' => '0.000000',
                'millions_mois' => SrotAgregats::enMillions($a->getValeurMoisFcfa()),
                'millions_cumul' => $a->getValeurCumulMillions(),
            ];
        }

        return $out;
    }
}

