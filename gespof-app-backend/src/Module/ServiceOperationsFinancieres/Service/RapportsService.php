<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Service;

use App\Module\ServiceOperationsFinancieres\Entite\Periode;
use App\Module\ServiceOperationsFinancieres\Entite\Referentiel\HorsSrotValeur;
use App\Module\ServiceOperationsFinancieres\Entite\Referentiel\RapportCommentaire;
use App\Module\ServiceOperationsFinancieres\Enum\StatutPeriode;
use App\Module\ServiceOperationsFinancieres\Enum\TypeLoiFinances;
use App\Module\ServiceOperationsFinancieres\Repository\HorsSrotValeurRepository;
use App\Module\ServiceOperationsFinancieres\Repository\LoiFinancesRepository;
use App\Module\ServiceOperationsFinancieres\Repository\MontantMensuelRepository;
use App\Module\ServiceOperationsFinancieres\Repository\PeriodeRepository;
use App\Module\ServiceOperationsFinancieres\Repository\RapportCommentaireRepository;
use App\Module\ServiceOperationsFinancieres\Support\DgbfipRecettesMapping;
use App\Module\ServiceOperationsFinancieres\Support\SrotAgregats;
use App\Shared\Exception\DonneesInvalidesException;
use Doctrine\ORM\EntityManagerInterface;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;

/**
 * Rapports SOF — SPEC §11 (Lot 9) : Fiche SROT, TDB, DGBFiP.
 */
class RapportsService
{
    private const COMMENTAIRES = [
        'commentaire_recettes',
        'commentaire_depenses',
        'commentaire_financement',
    ];

    public function __construct(
        private readonly PeriodeRepository $periodeRepository,
        private readonly RapportCommentaireRepository $rapportCommentaireRepository,
        private readonly HorsSrotValeurRepository $horsSrotValeurRepository,
        private readonly MontantMensuelRepository $montantMensuelRepository,
        private readonly LoiFinancesRepository $loiFinancesRepository,
        private readonly SrotSituationService $srotSituationService,
        private readonly ExecutionRapService $executionRapService,
        private readonly ExecutionDepensesService $executionDepensesService,
        private readonly EntityManagerInterface $em,
    ) {
    }

    /**
     * Fiche SROT (MBCP) — variables calculées + commentaires.
     *
     * @return array<string, mixed>
     */
    public function ficheSrot(?int $periodeId = null): array
    {
        $periode = $this->exigerPeriode($periodeId);
        $sit = $this->srotSituationService->situation($periode->getId());
        $byId = [];
        foreach ($sit['lignes'] as $l) {
            $byId[$l['id']] = $l;
        }
        $rap = $this->executionRapService->situation($periode->getId());

        $get = static fn (string $id, string $col = 'mois'): string => (string) ($byId[$id][$col] ?? '0.00');
        $index = $this->indexConsolide($periode->getExercice()->getAnnee());
        $amort = bcadd(
            SrotAgregats::somme($index, SrotAgregats::codesCapitalDetteExt(), $periode->getMois(), false),
            SrotAgregats::somme($index, SrotAgregats::codesCapitalDetteInt(), $periode->getMois(), false),
            2,
        );

        $variables = [
            ['nom' => 'RECETTES_BUDGETAIRES', 'valeur' => $get('B'), 'source' => 'situation.B.mois'],
            ['nom' => 'DEPENSES_TOTALES', 'valeur' => $get('C'), 'source' => 'situation.C.mois'],
            ['nom' => 'SOLDE_MOIS', 'valeur' => $get('E'), 'source' => 'situation.E.mois'],
            ['nom' => 'TIRAGES', 'valeur' => $get('F'), 'source' => 'situation.F.mois (financement)'],
            ['nom' => 'AMORTISSEMENTS', 'valeur' => $amort, 'source' => 'AZ+AAA'],
            ['nom' => 'RAP_TOTAL', 'valeur' => (string) ($rap['kpis']['total_rap'] ?? '0.00'), 'source' => 'execution.rap'],
            ['nom' => 'SOLDE_AVEC_FINANCEMENT', 'valeur' => $get('G'), 'source' => 'situation.G.mois'],
            ['nom' => 'EQUILIBRE_TRESORERIE', 'valeur' => $get('J'), 'source' => 'situation.J.mois'],
            ['nom' => 'RECETTES_CUMUL', 'valeur' => $get('B', 'cumul'), 'source' => 'situation.B.cumul'],
            ['nom' => 'DEPENSES_CUMUL', 'valeur' => $get('C', 'cumul'), 'source' => 'situation.C.cumul'],
        ];

        $commentaires = [];
        foreach (self::COMMENTAIRES as $cle) {
            $row = $this->rapportCommentaireRepository->trouver((int) $periode->getId(), $cle);
            $commentaires[$cle] = $row?->getTexte() ?? '';
        }

        return [
            'periode' => $this->metaPeriode($periode),
            'peut_generer' => in_array(
                $periode->getStatut(),
                [StatutPeriode::VALIDEE, StatutPeriode::PUBLIEE, StatutPeriode::OUVERTE, StatutPeriode::EN_CONTROLE],
                true,
            ),
            'note' => 'Variables Table Rapport (SPEC §11). Modèle Word À CONFIRMER — export HTML/JSON disponible.',
            'variables' => $variables,
            'commentaires' => $commentaires,
            'apercu_html' => $this->apercuFicheHtml($periode, $variables, $commentaires),
        ];
    }

    /**
     * @param array<string, string> $commentaires
     *
     * @return array<string, mixed>
     */
    public function enregistrerCommentaires(int $periodeId, array $commentaires): array
    {
        $periode = $this->exigerPeriode($periodeId);
        foreach ($commentaires as $cle => $texte) {
            $cle = (string) $cle;
            if (!in_array($cle, self::COMMENTAIRES, true)) {
                continue;
            }
            $row = $this->rapportCommentaireRepository->trouver($periodeId, $cle);
            if ($row === null) {
                $row = new RapportCommentaire($periode, $cle);
                $this->em->persist($row);
            }
            $row->setTexte(trim((string) $texte));
        }
        $this->em->flush();

        return $this->ficheSrot($periodeId);
    }

    /**
     * Tableau de bord — SROT + hors SROT.
     *
     * @return array<string, mixed>
     */
    public function tableauDeBord(?int $periodeId = null): array
    {
        $periode = $this->exigerPeriode($periodeId);
        $annee = $periode->getExercice()->getAnnee();
        $mois = $periode->getMois();
        $sit = $this->srotSituationService->situation($periode->getId());
        $byId = [];
        foreach ($sit['lignes'] as $l) {
            $byId[$l['id']] = $l;
        }

        $hors = [];
        foreach ($this->horsSrotValeurRepository->lister($annee) as $h) {
            $hors[$h->getCode()][$h->getMois()] = $h->getValeur();
        }

        $moisBrent = [];
        for ($m = max(1, $mois - 5); $m <= $mois; ++$m) {
            $moisBrent[] = [
                'mois' => $m,
                'brent' => $hors['brent'][$m] ?? '',
                'usd_xaf' => $hors['usd_xaf'][$m] ?? '',
                'prevision_lf' => $hors['brent_prev'][$m] ?? '72',
            ];
        }

        return [
            'periode' => $this->metaPeriode($periode),
            'srot' => [
                'recettes' => $byId['B']['mois'] ?? '0.00',
                'depenses' => $byId['C']['mois'] ?? '0.00',
                'solde' => $byId['E']['mois'] ?? '0.00',
                'financement' => $byId['F']['mois'] ?? '0.00',
                'equilibre' => $byId['J']['mois'] ?? '0.00',
                'mode' => $sit['mode'] ?? 'ouvert',
            ],
            'hors_srot' => [
                'cours' => $moisBrent,
                'ota_ressources' => $hors['ota_ressources'][0] ?? ($hors['ota_ressources'][$mois] ?? ''),
                'ota_charges' => $hors['ota_charges'][0] ?? ($hors['ota_charges'][$mois] ?? ''),
                'tmp_bta' => $hors['tmp_bta'][0] ?? '',
                'pmp_ota' => $hors['pmp_ota'][0] ?? '',
                'pib_nominal' => $hors['pib_nominal'][0] ?? '',
                'debits_t1' => $hors['debit_t1'][0] ?? '',
                'debits_t2' => $hors['debit_t2'][0] ?? '',
                'debits_t3' => $hors['debit_t3'][0] ?? '',
            ],
            'note' => 'Données hors SROT saisies par le SCR (SPEC §11).',
        ];
    }

    /**
     * @param list<array<string, mixed>> $valeurs
     *
     * @return array<string, mixed>
     */
    public function enregistrerHorsSrot(int $exerciceAnnee, array $valeurs): array
    {
        foreach ($valeurs as $row) {
            if (!\is_array($row) || !isset($row['code'])) {
                continue;
            }
            $code = trim((string) $row['code']);
            $mois = isset($row['mois']) ? (int) $row['mois'] : 0;
            $valeur = trim((string) ($row['valeur'] ?? ''));
            $ent = $this->horsSrotValeurRepository->trouver($exerciceAnnee, $mois, $code);
            if ($ent === null) {
                $ent = new HorsSrotValeur($exerciceAnnee, $mois, $code, $valeur);
                $this->em->persist($ent);
            } else {
                $ent->setValeur($valeur);
            }
        }
        $this->em->flush();

        return ['ok' => true, 'exercice' => $exerciceAnnee, 'nb' => count($valeurs)];
    }

    /**
     * Exécution DGBFiP — onglets.
     *
     * @return array<string, mixed>
     */
    public function dgbfip(?int $periodeId = null, string $loi = 'LFR'): array
    {
        $periode = $this->exigerPeriode($periodeId);
        $annee = $periode->getExercice()->getAnnee();
        $mois = $periode->getMois();
        $index = $this->indexConsolide($annee);
        $lfi = $this->totauxLoi($annee, TypeLoiFinances::LFI);
        $lfr = $this->totauxLoi($annee, TypeLoiFinances::LFR);
        if ($lfr === '0.00') {
            $lfr = $lfi;
        }

        $recettes = [];
        foreach (DgbfipRecettesMapping::articles() as $article => $def) {
            $exec = SrotAgregats::somme($index, $def['codes'], $mois, true);
            $prev = $loi === 'LFI' ? $lfi : $lfr;
            // répartition grossière : LFR / nb articles pour taux indicatif
            $partPrev = bcdiv($prev, (string) max(1, count(DgbfipRecettesMapping::articles())), 2);
            $taux = bccomp($partPrev, '0', 2) === 0
                ? null
                : bcmul(bcdiv($exec, $partPrev, 6), '100', 2);
            $recettes[] = [
                'article' => $article,
                'libelle' => $def['libelle'],
                'lfi' => $partPrev,
                'execution' => $exec,
                'taux' => $taux,
                'codes' => $def['codes'],
            ];
        }

        $dep = $this->executionDepensesService->parTitres($periode->getId());
        $depenses = [];
        foreach ($dep['lignes'] as $l) {
            $dot = (string) $l['dotation'];
            $regl = (string) $l['total_reglements'];
            $taux = bccomp($dot, '0', 2) === 0
                ? null
                : bcmul(bcdiv($regl, $dot, 6), '100', 2);
            $depenses[] = [
                'libelle' => $l['libelle'],
                'lfi' => $dot,
                'ordonnancements' => $l['ordonne'],
                'reglements' => $regl,
                'taux' => $taux,
            ];
        }

        $sit = $this->srotSituationService->situation($periode->getId());
        $byId = [];
        foreach ($sit['lignes'] as $l) {
            $byId[$l['id']] = $l;
        }
        $tresorerie = [
            ['libelle' => 'Tirages / financement', 'execution' => $byId['F']['cumul'] ?? '0.00'],
            ['libelle' => 'Amortissements (dette)', 'execution' => bcadd(
                SrotAgregats::somme($index, SrotAgregats::codesCapitalDetteExt(), $mois, true),
                SrotAgregats::somme($index, SrotAgregats::codesCapitalDetteInt(), $mois, true),
                2,
            )],
            ['libelle' => 'Solde avec financement', 'execution' => $byId['G']['cumul'] ?? '0.00'],
        ];

        $loiLibelle = sprintf('%s %d', strtoupper($loi), $annee);

        return [
            'periode' => $this->metaPeriode($periode),
            'parametres' => [
                'annee' => $annee,
                'loi' => $loiLibelle,
                'mois' => $mois,
                'colonne_excel' => chr(97 + 2 * $mois), // CHAR(97 + 2×mois)
            ],
            'note' => 'En-têtes tirés du paramétrage (écart E11 corrigé). Correspondance CSV DGBFiP partielle.',
            'onglets' => [
                'recettes' => $recettes,
                'depenses' => $depenses,
                'tresorerie' => $tresorerie,
            ],
        ];
    }

    /**
     * Export classeur DGBFiP (xlsx).
     *
     * @return array{filename: string, content: string, content_type: string}
     */
    public function exporterDgbfipXlsx(?int $periodeId = null, string $loi = 'LFR'): array
    {
        $data = $this->dgbfip($periodeId, $loi);
        $ss = new Spreadsheet();

        $ws = $ss->getActiveSheet();
        $ws->setTitle('Recettes');
        $ws->fromArray(['Article', 'Libellé', 'LFI/LFR', 'Exécution cumul', 'Taux %'], null, 'A1');
        $r = 2;
        foreach ($data['onglets']['recettes'] as $row) {
            $ws->fromArray([
                $row['article'],
                $row['libelle'],
                $row['lfi'],
                $row['execution'],
                $row['taux'],
            ], null, 'A'.$r);
            ++$r;
        }

        $ws2 = $ss->createSheet();
        $ws2->setTitle('Depenses');
        $ws2->fromArray(['Libellé', 'LFI', 'Ordonnancements', 'Règlements', 'Taux %'], null, 'A1');
        $r = 2;
        foreach ($data['onglets']['depenses'] as $row) {
            $ws2->fromArray([
                $row['libelle'],
                $row['lfi'],
                $row['ordonnancements'],
                $row['reglements'],
                $row['taux'],
            ], null, 'A'.$r);
            ++$r;
        }

        $ws3 = $ss->createSheet();
        $ws3->setTitle('Tresorerie');
        $ws3->fromArray(['Rubrique', 'Exécution'], null, 'A1');
        $r = 2;
        foreach ($data['onglets']['tresorerie'] as $row) {
            $ws3->fromArray([$row['libelle'], $row['execution']], null, 'A'.$r);
            ++$r;
        }

        $ws4 = $ss->createSheet();
        $ws4->setTitle('Parametres');
        $ws4->fromArray([
            ['Année', $data['parametres']['annee']],
            ['Loi', $data['parametres']['loi']],
            ['Mois', $data['parametres']['mois']],
            ['Colonne Excel', $data['parametres']['colonne_excel']],
            ['Note', $data['note']],
        ], null, 'A1');

        $tmp = tempnam(sys_get_temp_dir(), 'dgbfip');
        (new Xlsx($ss))->save($tmp);
        $content = (string) file_get_contents($tmp);
        @unlink($tmp);

        $filename = sprintf(
            'DGBFiP_%d_%02d.xlsx',
            $data['parametres']['annee'],
            $data['parametres']['mois'],
        );

        return [
            'filename' => $filename,
            'content' => $content,
            'content_type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ];
    }

    /**
     * Export HTML fiche SROT (impression → PDF).
     *
     * @return array{filename: string, content: string, content_type: string}
     */
    public function exporterFicheHtml(?int $periodeId = null): array
    {
        $fiche = $this->ficheSrot($periodeId);
        $p = $fiche['periode'];
        $filename = sprintf('Fiche_SROT_%d_%02d.html', $p['exercice_annee'], $p['mois']);

        return [
            'filename' => $filename,
            'content' => (string) $fiche['apercu_html'],
            'content_type' => 'text/html; charset=UTF-8',
        ];
    }

    /**
     * @param list<array{nom: string, valeur: string}> $variables
     * @param array<string, string>                    $commentaires
     */
    private function apercuFicheHtml(Periode $periode, array $variables, array $commentaires): string
    {
        $titre = sprintf('Fiche SROT · %02d/%d', $periode->getMois(), $periode->getExercice()->getAnnee());
        $rows = '';
        foreach ($variables as $v) {
            $rows .= sprintf(
                '<tr><td class="m">%s</td><td class="r">%s</td></tr>',
                htmlspecialchars($v['nom']),
                htmlspecialchars($v['valeur']),
            );
        }
        $coms = '';
        foreach ($commentaires as $k => $t) {
            if ($t === '') {
                continue;
            }
            $coms .= sprintf(
                '<p><strong>%s</strong><br/>%s</p>',
                htmlspecialchars(str_replace('_', ' ', $k)),
                nl2br(htmlspecialchars($t)),
            );
        }

        return <<<HTML
<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"/><title>{$titre}</title>
<style>
body{font-family:"IBM Plex Sans",Arial,sans-serif;color:#0f172a;font-size:12px;margin:24px}
h1{font-size:18px} table{width:100%;border-collapse:collapse;margin:16px 0}
td,th{border-bottom:1px solid #e2e8f0;padding:8px;text-align:left}
.m{font-family:"IBM Plex Mono",monospace}.r{text-align:right;font-family:"IBM Plex Mono",monospace}
@media print{.noprint{display:none}}
</style></head><body>
<button class="noprint" onclick="window.print()">Imprimer / PDF</button>
<h1>{$titre}</h1>
<p>Situation résumée des opérations du Trésor — DOMF / SOF</p>
<table><thead><tr><th>Variable</th><th>Valeur (FCFA)</th></tr></thead><tbody>{$rows}</tbody></table>
{$coms}
</body></html>
HTML;
    }

    private function totauxLoi(int $annee, TypeLoiFinances $type): string
    {
        $s = '0.00';
        foreach ($this->loiFinancesRepository->listerParExercice($annee) as $loi) {
            if ($loi->getType() !== $type) {
                continue;
            }
            foreach ($loi->getRecettes() as $r) {
                $s = bcadd($s, $r->getMontant(), 2);
            }
        }

        return $s;
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
     * @return array<string, mixed>
     */
    private function metaPeriode(Periode $p): array
    {
        return [
            'id' => $p->getId(),
            'exercice_annee' => $p->getExercice()->getAnnee(),
            'mois' => $p->getMois(),
            'statut' => $p->getStatut()->value,
            'statut_libelle' => $p->getStatut()->libelle(),
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
