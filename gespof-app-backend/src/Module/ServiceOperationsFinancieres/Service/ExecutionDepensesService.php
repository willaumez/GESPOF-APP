<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Service;

use App\Module\ServiceOperationsFinancieres\Entite\Import\DcReglement;
use App\Module\ServiceOperationsFinancieres\Entite\Periode;
use App\Module\ServiceOperationsFinancieres\Enum\StatutLotImport;
use App\Module\ServiceOperationsFinancieres\Enum\TypeLoiFinances;
use App\Module\ServiceOperationsFinancieres\Repository\DcReglementRepository;
use App\Module\ServiceOperationsFinancieres\Repository\LoiFinancesRepository;
use App\Module\ServiceOperationsFinancieres\Repository\LotImportRepository;
use App\Module\ServiceOperationsFinancieres\Repository\PeriodeRepository;
use App\Module\ServiceOperationsFinancieres\Repository\RapAnterieurLotRepository;
use App\Module\ServiceOperationsFinancieres\Support\ExecutionRapCalcul;
use App\Shared\Exception\DonneesInvalidesException;

/**
 * Exécution des dépenses — SPEC §10.2 (Lot 8).
 */
class ExecutionDepensesService
{
    private const TITRES = [
        '1' => 'Titre 1 · Charges financières de la dette',
        '2' => 'Titre 2 · Dépenses de personnel',
        '3' => 'Titre 3 · Biens et services',
        '4' => 'Titre 4 · Transferts',
        '5' => 'Titre 5 · Investissements',
        '6' => 'Titre 6 · Autres dépenses',
    ];

    public function __construct(
        private readonly PeriodeRepository $periodeRepository,
        private readonly LotImportRepository $lotImportRepository,
        private readonly DcReglementRepository $dcReglementRepository,
        private readonly LoiFinancesRepository $loiFinancesRepository,
        private readonly RapAnterieurLotRepository $rapAnterieurLotRepository,
        private readonly ExecutionRapService $executionRapService,
    ) {
    }

    /**
     * @return array<string, mixed>
     */
    public function parTitres(?int $periodeId = null): array
    {
        return $this->tableau($periodeId, 'titre');
    }

    /**
     * @return array<string, mixed>
     */
    public function parTitresNatures(?int $periodeId = null): array
    {
        return $this->tableau($periodeId, 'titre_nature');
    }

    /**
     * @return array<string, mixed>
     */
    public function parMissions(?int $periodeId = null): array
    {
        return $this->tableau($periodeId, 'mission_prog');
    }

    /**
     * @return array<string, mixed>
     */
    public function horsOrdonnances(?int $periodeId = null): array
    {
        [$periode, $reglements, $ordosRap] = $this->chargerContexte($periodeId);
        $hors = [];
        $totalRegl = '0.00';
        $totalHors = '0.00';
        foreach ($reglements as $r) {
            if (!$this->estReglementBudgetaire($r, $periode->getExercice()->getAnnee())) {
                continue;
            }
            $mt = $r->getMRegl() ?? '0.00';
            $totalRegl = bcadd($totalRegl, $mt, 2);
            $ordo = trim((string) $r->getOrdonnance());
            if ($ordo !== '' && isset($ordosRap[$ordo])) {
                continue;
            }
            $totalHors = bcadd($totalHors, $mt, 2);
            $hors[] = [
                'ordonnance' => $ordo !== '' ? $ordo : '—',
                'date' => $r->getDatRegl()?->format('Y-m-d'),
                'beneficiaire' => $r->getNom(),
                'titre' => $r->getTitre(),
                'montant' => $mt,
            ];
        }
        $part = bccomp($totalRegl, '0', 2) === 0
            ? '0.00'
            : bcmul(bcdiv($totalHors, $totalRegl, 6), '100', 2);

        return [
            'periode' => $this->metaPeriode($periode),
            'kpis' => [
                'nb_lignes' => count($hors),
                'total_hors' => $totalHors,
                'part_pct' => $part,
                'total_reglements' => $totalRegl,
            ],
            'lignes' => array_slice($hors, 0, 200),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function resume(?int $periodeId = null): array
    {
        $titres = $this->parTitres($periodeId);
        $rap = $this->executionRapService->situation($periodeId);
        $totDot = '0.00';
        $totOrdo = '0.00';
        $totRegl = '0.00';
        foreach ($titres['lignes'] as $l) {
            $totDot = bcadd($totDot, (string) $l['dotation'], 2);
            $totOrdo = bcadd($totOrdo, (string) $l['ordonne'], 2);
            $totRegl = bcadd($totRegl, (string) $l['total_reglements'], 2);
        }

        return [
            'periode' => $titres['periode'],
            'lignes' => [
                [
                    'code' => 'DOT',
                    'libelle' => 'Dotation (LF en vigueur)',
                    'montant' => $totDot,
                    '_fw' => 1,
                ],
                [
                    'code' => 'ORDO',
                    'libelle' => 'Ordonnancé',
                    'montant' => $totOrdo,
                    '_fw' => 1,
                ],
                [
                    'code' => 'REGL',
                    'libelle' => 'Total règlements',
                    'montant' => $totRegl,
                    '_fw' => 1,
                ],
                [
                    'code' => 'RAP',
                    'libelle' => 'RAP (situation)',
                    'montant' => $rap['kpis']['total_rap'] ?? '0.00',
                    '_fw' => 1,
                ],
                [
                    'code' => 'RAP_ANT',
                    'libelle' => 'RAP antérieurs (synthèse)',
                    'montant' => $rap['synthese']['totaux']['antérieurs'] ?? '0.00',
                    '_fw' => 0,
                ],
                [
                    'code' => 'RAP_CRN',
                    'libelle' => 'RAP exercice (synthèse)',
                    'montant' => $rap['synthese']['totaux']['exercice'] ?? '0.00',
                    '_fw' => 0,
                ],
            ],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function tableau(?int $periodeId, string $mode): array
    {
        [$periode, $reglements, $ordosRap] = $this->chargerContexte($periodeId);
        $annee = $periode->getExercice()->getAnnee();
        $dotations = $this->indexDotations($annee);
        $rapAntParCle = $this->indexRapAntieur($annee, $mode);

        /** @var array<string, array<string, mixed>> $agg */
        $agg = [];
        foreach ($reglements as $r) {
            if (!$this->estReglementBudgetaire($r, $annee)) {
                continue;
            }
            $titre = $this->normaliserTitre($r->getTitre());
            $gNat = ExecutionRapCalcul::grandeNature($r->getNat());
            $mission = trim((string) $r->getMission());
            $prog = trim((string) $r->getProg());
            $cle = match ($mode) {
                'titre_nature' => $titre.'|'.($gNat ?? '0'),
                'mission_prog' => ($mission !== '' ? $mission : '?').'|'.($prog !== '' ? $prog : '?'),
                default => $titre,
            };
            if (!isset($agg[$cle])) {
                $agg[$cle] = [
                    'cle' => $cle,
                    'titre' => $titre,
                    'g_nat' => $gNat,
                    'mission' => $mission,
                    'prog' => $prog,
                    'libelle' => $this->libelleCle($mode, $titre, $gNat, $mission, $prog, $r),
                    'dotation' => '0.00',
                    'ordonne' => '0.00',
                    'regl_ex' => '0.00',
                    'regl_ant' => '0.00',
                    'instances_ant' => '0.00',
                ];
            }
            $mt = $r->getMRegl() ?? '0.00';
            $type = strtoupper(trim((string) ($r->getType() ?? $r->getType1() ?? 'EX')));
            $estAnt = str_contains($type, 'ANT')
                || ((int) ($r->getEx() ?? $annee) !== $annee);
            if ($estAnt) {
                $agg[$cle]['regl_ant'] = bcadd($agg[$cle]['regl_ant'], $mt, 2);
            } else {
                $agg[$cle]['regl_ex'] = bcadd($agg[$cle]['regl_ex'], $mt, 2);
            }
            // Ordonnancé approx : règlements hors RAP antérieur (STATUT_RAP faux)
            $ordo = trim((string) $r->getOrdonnance());
            $statutRap = $ordo !== '' && isset($ordosRap[$ordo]);
            if (!$statutRap) {
                $agg[$cle]['ordonne'] = bcadd($agg[$cle]['ordonne'], $mt, 2);
            }
        }

        foreach ($dotations as $dCle => $mt) {
            if ($mode === 'titre') {
                $titre = explode('|', $dCle)[0];
                if (!isset($agg[$titre])) {
                    $agg[$titre] = [
                        'cle' => $titre,
                        'titre' => $titre,
                        'g_nat' => null,
                        'mission' => '',
                        'prog' => '',
                        'libelle' => self::TITRES[$titre] ?? ('Titre '.$titre),
                        'dotation' => '0.00',
                        'ordonne' => '0.00',
                        'regl_ex' => '0.00',
                        'regl_ant' => '0.00',
                        'instances_ant' => '0.00',
                    ];
                }
                $agg[$titre]['dotation'] = bcadd($agg[$titre]['dotation'], $mt, 2);
            } elseif ($mode === 'titre_nature' && isset($agg[$dCle])) {
                $agg[$dCle]['dotation'] = bcadd($agg[$dCle]['dotation'], $mt, 2);
            }
        }

        foreach ($rapAntParCle as $cle => $mt) {
            if (isset($agg[$cle])) {
                $agg[$cle]['instances_ant'] = bcadd($agg[$cle]['instances_ant'], $mt, 2);
            }
        }

        $lignes = [];
        foreach ($agg as $row) {
            $dot = $row['dotation'];
            $ordo = $row['ordonne'];
            $reglEx = $row['regl_ex'];
            $reglAnt = $row['regl_ant'];
            $inst = $row['instances_ant'];
            $restesEx = bcsub($ordo, $reglEx, 2);
            $restesAnt = bcsub($inst, $reglAnt, 2);
            $pctOrd = bccomp($dot, '0', 2) === 0
                ? null
                : bcmul(bcdiv($ordo, $dot, 6), '100', 2);
            $lignes[] = [
                'code' => $row['cle'],
                'libelle' => $row['libelle'],
                'titre' => $row['titre'],
                'dotation' => $dot,
                'ordonne' => $ordo,
                'pct_ord' => $pctOrd,
                'regl_ex' => $reglEx,
                'restes_ex' => $restesEx,
                'instances_ant' => $inst,
                'regl_ant' => $reglAnt,
                'restes_ant' => $restesAnt,
                'total_reglements' => bcadd($reglEx, $reglAnt, 2),
                'reste_negatif' => bccomp($restesAnt, '0', 2) < 0 || bccomp($restesEx, '0', 2) < 0,
                '_fw' => 1,
            ];
        }
        usort($lignes, static fn (array $a, array $b): int => strcmp((string) $a['code'], (string) $b['code']));

        $blocage = count(array_filter($lignes, static fn (array $l): bool => (bool) $l['reste_negatif']));

        return [
            'periode' => $this->metaPeriode($periode),
            'mode' => $mode,
            'blocage_publication' => $blocage > 0,
            'nb_restes_negatifs' => $blocage,
            'note' => 'Ordonnancé approximé via règlements hors RAP antérieurs (XLOP à brancher).',
            'lignes' => $lignes,
        ];
    }

    /**
     * @return array{0: Periode, 1: list<DcReglement>, 2: array<string, true>}
     */
    private function chargerContexte(?int $periodeId): array
    {
        $periode = $this->exigerPeriode($periodeId);
        $lots = $this->lotImportRepository->lister($periode->getId(), StatutLotImport::ACTIF);
        $ids = [];
        foreach ($lots as $lot) {
            $source = (string) ($lot->getParametres()['source'] ?? '');
            if ($source === 'dc-regl' || str_starts_with($source, 'dc-regl') || $lot->getFormat()->value === 'F2') {
                $ids[] = (int) $lot->getId();
            }
        }
        $reglements = $this->dcReglementRepository->listerParLots($ids);
        $ordosRap = [];
        $lotRap = $this->rapAnterieurLotRepository->trouverDernier($periode->getExercice()->getAnnee());
        if ($lotRap !== null) {
            foreach ($lotRap->getLignes() as $l) {
                $ordosRap[trim($l->getOrdonnance())] = true;
            }
        }

        return [$periode, $reglements, $ordosRap];
    }

    private function estReglementBudgetaire(DcReglement $r, int $annee): bool
    {
        $categ = strtoupper(trim((string) $r->getCateg()));
        if ($categ !== '' && $categ !== 'REG') {
            return false;
        }
        $titre = $this->normaliserTitre($r->getTitre());
        $type = strtoupper(trim((string) ($r->getType() ?? '')));
        $estAnt = str_contains($type, 'ANT');
        // Retirer titre 2 exercice courant
        if ($titre === '2' && !$estAnt) {
            $ex = (int) ($r->getEx() ?? $annee);
            if ($ex === $annee) {
                return false;
            }
        }

        return true;
    }

    /**
     * @return array<string, string> cle titre|g_nat → montant
     */
    private function indexDotations(int $annee): array
    {
        $out = [];
        foreach ($this->loiFinancesRepository->listerParExercice($annee) as $loi) {
            if ($loi->getType() !== TypeLoiFinances::LFR && $loi->getType() !== TypeLoiFinances::LFI) {
                continue;
            }
            foreach ($loi->getDepenses() as $d) {
                $titre = $this->normaliserTitre($d->getTitre());
                $gNat = ExecutionRapCalcul::grandeNature($d->getNat());
                $cle = $titre.'|'.($gNat ?? '0');
                $out[$cle] = bcadd($out[$cle] ?? '0.00', $d->getMontant(), 2);
                $out[$titre.'|0'] = bcadd($out[$titre.'|0'] ?? '0.00', $d->getMontant(), 2);
            }
            // Prefer LFR if present
            if ($loi->getType() === TypeLoiFinances::LFR) {
                break;
            }
        }

        return $out;
    }

    /**
     * @return array<string, string>
     */
    private function indexRapAntieur(int $annee, string $mode): array
    {
        $out = [];
        $lot = $this->rapAnterieurLotRepository->trouverDernier($annee);
        if ($lot === null) {
            return $out;
        }
        foreach ($lot->getLignes() as $l) {
            $titre = $this->normaliserTitre($l->getTitre());
            $gNat = ExecutionRapCalcul::grandeNature($l->getNature());
            $cle = match ($mode) {
                'titre_nature' => $titre.'|'.($gNat ?? '0'),
                'mission_prog' => '?', // pas de mission sur RAP antérieur
                default => $titre,
            };
            if ($mode === 'mission_prog') {
                continue;
            }
            $out[$cle] = bcadd($out[$cle] ?? '0.00', $l->getRap(), 2);
        }

        return $out;
    }

    private function normaliserTitre(?string $titre): string
    {
        $t = trim((string) $titre);
        $t = ltrim($t, '0');

        return $t !== '' ? $t : '?';
    }

    private function libelleCle(
        string $mode,
        string $titre,
        ?int $gNat,
        string $mission,
        string $prog,
        DcReglement $r,
    ): string {
        return match ($mode) {
            'titre_nature' => sprintf(
                '%s · G_NAT %s',
                self::TITRES[$titre] ?? ('Titre '.$titre),
                $gNat ?? '—',
            ),
            'mission_prog' => sprintf(
                '%s · %s',
                $mission !== '' ? ($mission.($r->getLMis() ? ' · '.$r->getLMis() : '')) : 'Mission ?',
                $prog !== '' ? ($prog.($r->getLProg() ? ' · '.$r->getLProg() : '')) : 'Prog ?',
            ),
            default => self::TITRES[$titre] ?? ('Titre '.$titre),
        };
    }

    /**
     * @return array<string, mixed>
     */
    private function metaPeriode(Periode $p): array
    {
        return [
            'id' => $p->getId(),
            'exercice_annee' => $p->getExercice()->getAnnee(),
            'mois' => $p->getMois(),
            'date_situation' => $p->getDateSituation()?->format('Y-m-d'),
        ];
    }

    private function exigerPeriode(?int $periodeId): Periode
    {
        if ($periodeId !== null && $periodeId > 0) {
            $p = $this->periodeRepository->find($periodeId);
            if (!$p instanceof Periode) {
                throw new DonneesInvalidesException(sprintf('Période #%d introuvable.', $periodeId));
            }

            return $p;
        }
        $periodes = $this->periodeRepository->createQueryBuilder('p')
            ->leftJoin('p.exercice', 'e')->addSelect('e')
            ->orderBy('e.annee', 'DESC')->addOrderBy('p.mois', 'DESC')
            ->setMaxResults(1)->getQuery()->getResult();
        if ($periodes === []) {
            throw new DonneesInvalidesException('Aucune période SROT.');
        }

        return $periodes[0];
    }
}
