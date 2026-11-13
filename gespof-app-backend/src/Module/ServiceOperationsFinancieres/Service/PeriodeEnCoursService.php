<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Service;

use App\Module\ServiceOperationsFinancieres\Entite\Exercice;
use App\Module\ServiceOperationsFinancieres\Entite\Import\LotImport;
use App\Module\ServiceOperationsFinancieres\Entite\Periode;
use App\Module\ServiceOperationsFinancieres\Entite\PointAttention;
use App\Module\ServiceOperationsFinancieres\Entite\Recette\Rapprochement;
use App\Module\ServiceOperationsFinancieres\Enum\DomaineRapprochement;
use App\Module\ServiceOperationsFinancieres\Enum\Mois;
use App\Module\ServiceOperationsFinancieres\Enum\PointAttentionCode;
use App\Module\ServiceOperationsFinancieres\Enum\StatutLotImport;
use App\Module\ServiceOperationsFinancieres\Enum\StatutPeriode;
use App\Module\ServiceOperationsFinancieres\Repository\ExerciceRepository;
use App\Module\ServiceOperationsFinancieres\Repository\LotImportRepository;
use App\Module\ServiceOperationsFinancieres\Repository\PeriodeRepository;
use App\Module\ServiceOperationsFinancieres\Repository\PointAttentionRepository;
use App\Module\ServiceOperationsFinancieres\Repository\RapprochementRepository;
use App\Shared\Exception\DonneesInvalidesException;
use Doctrine\ORM\EntityManagerInterface;

/**
 * Synthèse « Période en cours » (maquette SOF v2 — accueil).
 */
class PeriodeEnCoursService
{
    /**
     * Catalogue imports (maquette sof-data IMP) → libellé, origine, route FE, formats attendus.
     * Les formats listés sont ceux utilisés par les services d'import métier
     * (évite les lots seed incohérents, ex. dc-regl en F1 alors que le service lit F2).
     *
     * @var list<array{cle: string, source: string, origine: string, href: string, formats: list<string>}>
     */
    private const CATALOGUE_IMPORTS = [
        ['cle' => 'dc-regl', 'source' => 'Règlements sur ordonnances', 'origine' => 'DC', 'href' => '/sof/imports/extractions?onglet=dc-reglements&preset=dc-xrgv', 'formats' => ['F2']],
        ['cle' => 'dc-ordos', 'source' => 'Ordonnances visées', 'origine' => 'DC', 'href' => '/sof/imports/extractions?onglet=dc-ordonnances&preset=dc-xlop', 'formats' => ['F3']],
        ['cle' => 'dc-rap-bop', 'source' => 'RAP mode BOP', 'origine' => 'DC', 'href' => '/sof/imports/extractions?onglet=dc-rap&preset=dc-xrav', 'formats' => ['F6']],
        ['cle' => 'dc-rap-avant-bop', 'source' => 'RAP avant BOP', 'origine' => 'DC', 'href' => '/sof/imports/extractions?onglet=dc-rap&preset=dc-rap-avant-bop', 'formats' => []],
        ['cle' => 'dc-cdel', 'source' => 'Situation des crédits délégués', 'origine' => 'DC', 'href' => '/sof/imports/extractions?onglet=dc-ordonnances&preset=dc-cdel', 'formats' => ['F6']],
        ['cle' => 'dc-tva', 'source' => 'Règlements TVA', 'origine' => 'DC', 'href' => '/sof/imports/extractions?onglet=dc-reglements&preset=dc-xrgm-tva', 'formats' => ['F4']],
        ['cle' => 'dc-rap-tva', 'source' => 'RAP TVA', 'origine' => 'DC', 'href' => '/sof/imports/extractions?onglet=dc-rap&preset=dc-xram-tva', 'formats' => ['F5']],
        ['cle' => 'ig-cdel', 'source' => 'Crédits délégués (4742)', 'origine' => 'IG', 'href' => '/sof/imports/extractions?onglet=ig-operations&preset=ig-cdel-4742', 'formats' => ['F1']],
        ['cle' => 'ig-avances', 'source' => 'Avances au budget (4701-5 / 4706-1)', 'origine' => 'IG', 'href' => '/sof/imports/extractions?onglet=ig-operations&preset=ig-avances-etat', 'formats' => ['F1']],
        ['cle' => 'ig-tva', 'source' => 'Règlements TVA', 'origine' => 'IG', 'href' => '/sof/imports/extractions?onglet=ig-operations&preset=ig-tva', 'formats' => ['F1']],
        ['cle' => 'ig-douanes', 'source' => 'Comptes douanes', 'origine' => 'IG', 'href' => '/sof/imports/extractions?onglet=ig-operations&preset=ig-douanes', 'formats' => ['F1', 'F8']],
        ['cle' => 'ig-petrole', 'source' => 'Comptes pétrole', 'origine' => 'IG', 'href' => '/sof/imports/extractions?onglet=ig-operations&preset=ig-petrole-1812-201', 'formats' => ['F1', 'F7']],
        ['cle' => 'ig-fiscal', 'source' => 'Recettes fiscales (1812 / 4781 / 4783)', 'origine' => 'IG', 'href' => '/sof/imports/extractions?onglet=ig-operations&preset=ig-recettes-fiscales', 'formats' => ['F1', 'F13']],
        ['cle' => 'ig-deversements', 'source' => 'Déversements solde et pension', 'origine' => 'IG', 'href' => '/sof/imports/extractions?onglet=ig-recaps&preset=ig-rcdd', 'formats' => ['F1']],
        ['cle' => 'srv-correspondants', 'source' => 'Correspondants (DSI)', 'origine' => 'Service', 'href' => '/sof/imports/services/correspondants', 'formats' => ['F10']],
        ['cle' => 'srv-mvm-fe', 'source' => 'Mouvements de fonds et effets', 'origine' => 'Service', 'href' => '/sof/imports/extractions?onglet=ig-operations&preset=ig-mvm-fe', 'formats' => ['F14']],
        ['cle' => 'srv-dette', 'source' => 'Exécution de la dette (TDP)', 'origine' => 'Service', 'href' => '/sof/imports/services/dette', 'formats' => ['F14']],
        ['cle' => 'srv-titres', 'source' => 'Émissions BTA / OTA (SMC)', 'origine' => 'Service', 'href' => '/sof/imports/services/titres', 'formats' => ['F14']],
        ['cle' => 'srv-facilites', 'source' => 'Facilités et agios (SCR)', 'origine' => 'Service', 'href' => '/sof/imports/services/facilites', 'formats' => ['F14']],
        ['cle' => 'srv-covid', 'source' => 'Fonds COVID-19', 'origine' => 'Service', 'href' => '/sof/imports/services/covid', 'formats' => ['F14']],
        ['cle' => 'srv-liquidatifs', 'source' => 'États liquidatifs (solde, MONP, pension)', 'origine' => 'Service', 'href' => '/sof/imports/services/liquidatifs', 'formats' => ['F14']],
        ['cle' => 'srv-fiches-comptes', 'source' => 'Fiches de comptes (CAS Pensions, CNAMGS)', 'origine' => 'Service', 'href' => '/sof/imports/services/fiches-comptes', 'formats' => ['F14']],
        ['cle' => 'cpt-balance', 'source' => 'Balance générale mensuelle', 'origine' => 'Comptabilité', 'href' => '/sof/imports/comptabilite/balance', 'formats' => ['F14']],
    ];

    /**
     * Étapes du cycle SROT (maquette).
     *
     * @var list<array{code: string, libelle: string, href: string}>
     */
    private const ETAPES = [
        ['code' => 'rap', 'libelle' => 'RAP', 'href' => '/sof/execution/rap'],
        ['code' => 'rapprochement', 'libelle' => 'Rapprochement des recettes', 'href' => '/sof/recettes/petrolieres/rapprochement'],
        ['code' => 'srot', 'libelle' => 'SROT', 'href' => '/sof/srot/situation'],
        ['code' => 'depenses', 'libelle' => 'Dépenses budgétaires', 'href' => '/sof/execution/depenses/titres'],
        ['code' => 'analyse_rap', 'libelle' => 'Analyse des RAP', 'href' => '/sof/execution/analyse-rap'],
        ['code' => 'tdb', 'libelle' => 'Tableau de bord', 'href' => '/sof/rapports/tableau-de-bord'],
        ['code' => 'fiche', 'libelle' => 'Fiche SROT', 'href' => '/sof/rapports/fiche-srot'],
        ['code' => 'transmission', 'libelle' => 'Transmission', 'href' => '/sof/rapports/publications'],
    ];

    public function __construct(
        private readonly ExerciceRepository $exerciceRepository,
        private readonly PeriodeRepository $periodeRepository,
        private readonly LotImportRepository $lotImportRepository,
        private readonly PointAttentionRepository $pointAttentionRepository,
        private readonly RapprochementRepository $rapprochementRepository,
        private readonly ExerciceService $exerciceService,
        private readonly PeriodeService $periodeService,
        private readonly EntityManagerInterface $em,
    ) {
    }

    /**
     * @return array<string, mixed>
     */
    public function synthetiser(?int $periodeId = null): array
    {
        $exercice = $this->exerciceRepository->trouverCourant();
        $periode = $this->resoudrePeriode($exercice, $periodeId);

        $exerciceData = $exercice instanceof Exercice
            ? $this->exerciceService->serialiser($exercice)
            : null;
        $periodeData = $periode instanceof Periode
            ? $this->periodeService->serialiser($periode)
            : null;

        $imports = $this->construireImports($periode);
        $recus = count(array_filter($imports, static fn (array $i): bool => $i['statut'] === 'recu'));
        $total = count($imports);

        $ecarts = $this->construireEcarts($periode);
        $points = $this->construirePoints($periode);
        $etapes = $this->construireEtapes($periode, $ecarts);
        $dernierRd = $this->dernierRdValide($exercice);
        $synthese = $this->construireSynthese($periode);

        $nDone = $etapes['n_done'];
        $etapeEnCours = self::ETAPES[min($nDone, count(self::ETAPES) - 1)];

        $pointsCoches = count(array_filter($points, static fn (array $p): bool => $p['coche']));
        $pointsTotal = count($points);

        return [
            'exercice' => $exerciceData,
            'periode' => $periodeData,
            'periode_libelle' => $this->libellePeriode($periode),
            'description' => $periode instanceof Periode
                ? sprintf(
                    'Avancement de la production de la SROT de %s et ce qu\'il reste à faire.',
                    $this->libellePeriode($periode),
                )
                : 'Avancement de la production SROT : exercice, date de situation et statut des imports.',
            'kpis' => $this->construireKpisEntete($exercice, $periode, $dernierRd),
            'etapes' => $etapes['items'],
            'etape_en_cours_href' => $etapeEnCours['href'],
            'peut_ouvrir_suivante' => $periode instanceof Periode
                && $periode->getStatut() === StatutPeriode::PUBLIEE,
            'imports' => $imports,
            'imports_recus' => $recus,
            'imports_total' => $total,
            'imports_sous_titre' => sprintf('%d / %d sources reçues', $recus, $total),
            'ecarts' => $ecarts,
            'points_attention' => $points,
            'points_coches' => $pointsCoches,
            'points_total' => $pointsTotal,
            'points_pied' => sprintf(
                '%d / %d cochés · la validation du mois est bloquée tant qu\'un point n\'est pas coché.',
                $pointsCoches,
                $pointsTotal,
            ),
            'synthese' => $synthese,
            // Compat. anciens clients
            'dernier_rd_valide' => $dernierRd,
        ];
    }

    /**
     * Coche / décoche un point d'attention.
     *
     * @return array<string, mixed>
     */
    public function basculerPointAttention(int $periodeId, string $code, bool $coche): array
    {
        $periode = $this->periodeRepository->find($periodeId);
        if (!$periode instanceof Periode) {
            throw new DonneesInvalidesException(sprintf('Période #%d introuvable.', $periodeId));
        }

        $enum = PointAttentionCode::tryFrom($code);
        if (!$enum instanceof PointAttentionCode) {
            throw new DonneesInvalidesException(sprintf('Code de point d\'attention invalide : %s.', $code));
        }

        if ($periode->getStatut() === StatutPeriode::PUBLIEE) {
            throw new DonneesInvalidesException('La période publiée est en lecture seule.');
        }

        $row = $this->pointAttentionRepository->trouver($periodeId, $enum);
        if (!$row instanceof PointAttention) {
            $row = new PointAttention($periode, $enum);
            $this->em->persist($row);
        }
        $row->setCoche($coche);
        $this->em->flush();

        return $this->synthetiser($periodeId);
    }

    /**
     * Ouvre le mois suivant (chef SOF) — disponible une fois la période publiée.
     *
     * @return array<string, mixed>
     */
    public function ouvrirPeriodeSuivante(int $periodeId): array
    {
        $periode = $this->periodeRepository->find($periodeId);
        if (!$periode instanceof Periode) {
            throw new DonneesInvalidesException(sprintf('Période #%d introuvable.', $periodeId));
        }
        if ($periode->getStatut() !== StatutPeriode::PUBLIEE) {
            throw new DonneesInvalidesException('Disponible une fois la période publiée.');
        }

        $annee = $periode->getExercice()->getAnnee();
        $mois = $periode->getMois() + 1;
        if ($mois > 12) {
            $mois = 1;
            ++$annee;
        }

        $ouverte = $this->periodeService->ouvrir($annee, $mois);

        return [
            'periode' => $ouverte,
            'synthese' => $this->synthetiser((int) $ouverte['id']),
        ];
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function construireKpisEntete(
        ?Exercice $exercice,
        ?Periode $periode,
        ?array $dernierRd,
    ): array {
        $dateSit = $periode?->getDateSituation();
        $semaine = $dateSit instanceof \DateTimeImmutable
            ? (int) $dateSit->format('W')
            : null;

        return [
            [
                'code' => 'exercice',
                'label' => 'Exercice',
                'valeur' => $exercice ? (string) $exercice->getAnnee() : '—',
                'unite' => null,
                'sous' => $exercice?->getDateOuverture()
                    ? sprintf('Ouvert le %s', $exercice->getDateOuverture()->format('d/m/Y'))
                    : ($exercice?->getStatut()->libelle() ?? '—'),
                'accent' => '#2a7f62',
                'fg' => '#0f172a',
            ],
            [
                'code' => 'loi',
                'label' => 'Loi en vigueur',
                'valeur' => $exercice?->getLoiEnVigueur()?->libelle($exercice->getAnnee()) ?? '—',
                'unite' => null,
                'sous' => $exercice?->getStatut()->libelle() ?? '—',
                'accent' => '#2a7f62',
                'fg' => '#0f172a',
            ],
            [
                'code' => 'situation',
                'label' => 'Date de situation',
                'valeur' => $dateSit?->format('d/m/Y') ?? '—',
                'unite' => null,
                'sous' => $semaine !== null
                    ? sprintf('Hebdomadaire · semaine %d', $semaine)
                    : ($periode ? $this->libellePeriode($periode) : 'Aucune période ouverte'),
                'accent' => '#2a7f62',
                'fg' => '#0f172a',
            ],
            [
                'code' => 'dernier_rd',
                'label' => 'Dernier RD validé',
                'valeur' => $dernierRd['libelle'] ?? '—',
                'unite' => null,
                'sous' => $dernierRd['sous'] ?? 'Aucun RD validé',
                'accent' => '#2a7f62',
                'fg' => '#0f172a',
            ],
            [
                'code' => 'balance',
                'label' => 'Balance initiale',
                'valeur' => $exercice?->getBalanceInitiale() ?? '0.00',
                'unite' => 'FCFA',
                'sous' => $exercice ? sprintf('Au 01/01/%d', $exercice->getAnnee()) : '—',
                'accent' => '#2a7f62',
                'fg' => '#0f172a',
                'montant' => true,
            ],
        ];
    }

    /**
     * @param list<array<string, mixed>> $ecarts
     *
     * @return array{items: list<array<string, mixed>>, n_done: int}
     */
    private function construireEtapes(?Periode $periode, array $ecarts): array
    {
        $st = $periode?->getStatut();
        $allJust = $ecarts !== [] && !in_array(
            false,
            array_map(static fn (array $e): bool => (bool) $e['justifie'] || bccomp((string) $e['montant'], '0.00', 2) === 0, $ecarts),
            true,
        );

        $nDone = match ($st) {
            StatutPeriode::PUBLIEE => 8,
            StatutPeriode::VALIDEE => 3,
            default => $allJust ? 2 : 1,
        };

        $items = [];
        foreach (self::ETAPES as $i => $etape) {
            $statut = $i < $nDone ? 'termine' : ($i === $nDone ? 'en_cours' : 'a_faire');
            $items[] = [
                'n' => $i + 1,
                'code' => $etape['code'],
                'libelle' => $etape['libelle'],
                'href' => $etape['href'],
                'statut' => $statut,
                'statut_libelle' => match ($statut) {
                    'termine' => 'Terminé',
                    'en_cours' => 'En cours',
                    default => 'À faire',
                },
            ];
        }

        return ['items' => $items, 'n_done' => $nDone];
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function construireImports(?Periode $periode): array
    {
        $lots = $periode instanceof Periode && $periode->getId() !== null
            ? $this->lotImportRepository->lister($periode->getId())
            : [];

        $parCle = [];
        foreach ($lots as $lot) {
            $source = (string) ($lot->getParametres()['source'] ?? '');
            $format = $lot->getFormat()->value;
            foreach (self::CATALOGUE_IMPORTS as $cat) {
                $cle = $cat['cle'];
                if (!$this->lotCorrespondCatalogue($source, $format, $cat)) {
                    continue;
                }
                if (!isset($parCle[$cle])) {
                    $parCle[$cle] = [];
                }
                $parCle[$cle][] = $lot;
                break;
            }
        }

        $imports = [];
        foreach (self::CATALOGUE_IMPORTS as $cat) {
            /** @var list<LotImport> $lotsCle */
            $lotsCle = $parCle[$cat['cle']] ?? [];
            $actifs = array_values(array_filter(
                $lotsCle,
                static fn (LotImport $l): bool => $l->getStatut() === StatutLotImport::ACTIF,
            ));

            $dernier = null;
            foreach ($lotsCle as $lot) {
                if ($dernier === null || $lot->getImporteLe() > $dernier->getImporteLe()) {
                    $dernier = $lot;
                }
            }

            $nbLignes = 0;
            $dernierActif = null;
            foreach ($actifs as $lot) {
                $nbLignes += $lot->getNbLignes();
                if ($dernierActif === null || $lot->getImporteLe() > $dernierActif->getImporteLe()) {
                    $dernierActif = $lot;
                }
            }

            // « Reçu » seulement s'il existe un lot ACTIF cohérent avec le format métier.
            // Les lots seed (mauvais format / sans lignes métier) ne comptent plus.
            $statut = 'manquant';
            $statutLibelle = 'Manquant';
            $lotRef = $dernierActif;
            if ($actifs !== [] && $nbLignes > 0) {
                $statut = 'recu';
                $statutLibelle = 'Reçu';
            } elseif ($actifs !== []) {
                // Lot actif vide (import lancé, 0 ligne) — à valider / en cours
                $statut = 'a_valider';
                $statutLibelle = 'À valider';
                $lotRef = $dernierActif;
            } elseif ($dernier instanceof LotImport) {
                if ($dernier->getStatut() === StatutLotImport::ANNULE) {
                    $statut = 'annule';
                    $statutLibelle = 'Annulé';
                } else {
                    $statut = 'remplace';
                    $statutLibelle = 'Remplacé';
                }
                $lotRef = $dernier;
                $nbLignes = $dernier->getNbLignes();
            }

            $imports[] = [
                'cle' => $cat['cle'],
                'format' => $cat['formats'][0] ?? $cat['cle'],
                'source' => $cat['source'],
                'origine' => $cat['origine'],
                'href' => $cat['href'],
                'statut' => $statut,
                'statut_libelle' => $statutLibelle,
                'dernier_import' => $lotRef?->getImporteLe()->format('Y-m-d'),
                'nb_lignes' => $lotRef !== null ? $nbLignes : null,
                'nb_lots_actifs' => count($actifs),
                'lot_id' => $lotRef?->getId(),
                'lot_reference' => $lotRef?->reference(),
            ];
        }

        return $imports;
    }

    /**
     * @param array{cle: string, formats: list<string>} $cat
     */
    private function lotCorrespondCatalogue(string $source, string $format, array $cat): bool
    {
        $cle = $cat['cle'];
        $sourceOk = $source === $cle
            || str_starts_with($source, $cle.'-')
            || str_starts_with($source, $cle.'_');
        if (!$sourceOk) {
            return false;
        }

        $formats = $cat['formats'];
        if ($formats === []) {
            return true;
        }

        return in_array($format, $formats, true);
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function construireEcarts(?Periode $periode): array
    {
        $defs = [
            [
                'code' => 'pet',
                'domaine' => DomaineRapprochement::PETROLE,
                'label' => 'Pétrole · DOMF / DRPHP',
                'href' => '/sof/recettes/petrolieres/rapprochement',
            ],
            [
                'code' => 'dou',
                'domaine' => DomaineRapprochement::DOUANE,
                'label' => 'Douanes · DOMF / DRPHP',
                'href' => '/sof/recettes/douanieres/mois',
            ],
            [
                'code' => 'tva',
                'domaine' => null,
                'label' => 'TVA · DC / IG',
                'href' => '/sof/recettes/tva/rapprochement',
            ],
        ];

        $out = [];
        foreach ($defs as $def) {
            $montant = '0.00';
            $justifie = true;
            if ($periode instanceof Periode && $periode->getId() !== null && $def['domaine'] instanceof DomaineRapprochement) {
                $rows = $this->rapprochementRepository->listerParPeriodeDomaine(
                    $periode->getId(),
                    $def['domaine'],
                );
                foreach ($rows as $row) {
                    /** @var Rapprochement $row */
                    $e = $row->ecart();
                    $montant = bcadd($montant, $e, 2);
                    if (bccomp($e, '0.00', 2) !== 0
                        && ($row->getCommentaire() === null || $row->getCommentaire() === '')
                    ) {
                        $justifie = false;
                    }
                }
            }

            $hasEcart = bccomp($montant, '0.00', 2) !== 0;
            $out[] = [
                'code' => $def['code'],
                'label' => $def['label'],
                'montant' => $montant,
                'href' => $def['href'],
                'justifie' => !$hasEcart || $justifie,
                'sous' => !$hasEcart
                    ? 'Aucun écart'
                    : ($justifie ? 'Écart justifié' : 'Écart à justifier'),
                'accent' => $hasEcart ? '#b91c1c' : '#2a7f62',
                'fg' => $hasEcart ? '#b91c1c' : '#0f172a',
            ];
        }

        return $out;
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function construirePoints(?Periode $periode): array
    {
        $existants = [];
        if ($periode instanceof Periode && $periode->getId() !== null) {
            foreach ($this->pointAttentionRepository->listerParPeriode($periode->getId()) as $row) {
                $existants[$row->getCode()->value] = $row;
            }
        }

        $lectureSeule = $periode?->getStatut() === StatutPeriode::PUBLIEE;
        $points = [];
        foreach (PointAttentionCode::cases() as $code) {
            $row = $existants[$code->value] ?? null;
            $points[] = [
                'code' => $code->value,
                'libelle' => $code->libelle(),
                'sous_titre' => $code->sousTitre(),
                'coche' => $row instanceof PointAttention && $row->isCoche(),
                'lecture_seule' => $lectureSeule || !$periode instanceof Periode,
            ];
        }

        return $points;
    }

    /**
     * @return array<string, mixed>
     */
    private function construireSynthese(?Periode $periode): array
    {
        // Tant que la consolidation SROT n'est pas branchée : structure prête, montants nuls.
        $vide = $periode === null;
        $prevLib = $periode instanceof Periode && $periode->getMois() > 1
            ? (Mois::tryFrom($periode->getMois() - 1)?->libelle() ?? 'mois précédent')
            : 'période précédente';

        return [
            'disponible' => false,
            'message' => $vide
                ? 'Aucune période ouverte.'
                : 'Synthèse SROT non encore calculée pour cette période.',
            'items' => [
                [
                    'code' => 'recettes',
                    'label' => 'Recettes budgétaires',
                    'montant' => null,
                    'sous' => $vide ? '—' : 'vs '.$prevLib,
                    'accent' => '#1e6650',
                    'fg' => '#0f172a',
                ],
                [
                    'code' => 'depenses',
                    'label' => 'Dépenses totales',
                    'montant' => null,
                    'sous' => $vide ? '—' : 'vs '.$prevLib,
                    'accent' => '#b45309',
                    'fg' => '#0f172a',
                ],
                [
                    'code' => 'solde_mois',
                    'label' => 'Solde du mois',
                    'montant' => null,
                    'sous' => $vide ? '—' : 'vs '.$prevLib,
                    'accent' => '#b45309',
                    'fg' => '#0f172a',
                ],
                [
                    'code' => 'solde_cumule',
                    'label' => 'Solde cumulé',
                    'montant' => null,
                    'sous' => $vide ? '—' : 'vs fin '.$prevLib,
                    'accent' => '#1e6650',
                    'fg' => '#0f172a',
                ],
            ],
        ];
    }

    /**
     * @return array{libelle: string, sous: string}|null
     */
    private function dernierRdValide(?Exercice $exercice): ?array
    {
        if (!$exercice instanceof Exercice) {
            return null;
        }

        $periodes = $this->periodeRepository->listerParExercice($exercice->getAnnee());
        $candidates = array_values(array_filter(
            $periodes,
            static fn (Periode $p): bool => in_array(
                $p->getStatut(),
                [StatutPeriode::VALIDEE, StatutPeriode::PUBLIEE],
                true,
            ),
        ));
        if ($candidates === []) {
            return null;
        }

        usort(
            $candidates,
            static fn (Periode $a, Periode $b): int => $b->getMois() <=> $a->getMois(),
        );
        $p = $candidates[0];
        $mois = Mois::tryFrom($p->getMois());
        $lib = sprintf(
            '%s %d',
            $mois ? ucfirst($mois->libelle()) : (string) $p->getMois(),
            $exercice->getAnnee(),
        );

        return [
            'libelle' => $lib,
            'sous' => sprintf('Statut · %s', $p->getStatut()->libelle()),
        ];
    }

    private function libellePeriode(?Periode $periode): string
    {
        if (!$periode instanceof Periode) {
            return '—';
        }
        $mois = Mois::tryFrom($periode->getMois());
        $lib = $mois ? ucfirst($mois->libelle()) : (string) $periode->getMois();

        return sprintf('%s %d', $lib, $periode->getExercice()->getAnnee());
    }

    private function resoudrePeriode(?Exercice $exercice, ?int $periodeId): ?Periode
    {
        if ($periodeId !== null) {
            $p = $this->periodeRepository->find($periodeId);

            return $p instanceof Periode ? $p : null;
        }

        if (!$exercice instanceof Exercice) {
            return null;
        }

        $periodes = $this->periodeRepository->listerParExercice($exercice->getAnnee());
        if ($periodes === []) {
            return null;
        }

        usort(
            $periodes,
            static fn (Periode $a, Periode $b): int => $b->getMois() <=> $a->getMois(),
        );

        return $periodes[0];
    }
}
