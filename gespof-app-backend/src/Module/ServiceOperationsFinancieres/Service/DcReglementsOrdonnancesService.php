<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Service;

use App\Module\ServiceOperationsFinancieres\Entite\Import\AnomalieImport;
use App\Module\ServiceOperationsFinancieres\Entite\Import\LotImport;
use App\Module\ServiceOperationsFinancieres\Entite\Periode;
use App\Module\ServiceOperationsFinancieres\Enum\FormatImport;
use App\Module\ServiceOperationsFinancieres\Enum\Mois;
use App\Module\ServiceOperationsFinancieres\Enum\StatutLotImport;
use App\Module\ServiceOperationsFinancieres\Repository\DcReglementRepository;
use App\Module\ServiceOperationsFinancieres\Repository\LotImportRepository;
use App\Module\ServiceOperationsFinancieres\Repository\PeriodeRepository;
use App\Module\ServiceOperationsFinancieres\Repository\ScriptPoolSof;
use App\Shared\Entite\Utilisateur;
use App\Shared\Exception\DonneesInvalidesException;
use Doctrine\ORM\EntityManagerInterface;
use PhpOffice\PhpSpreadsheet\IOFactory;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\HttpFoundation\File\UploadedFile;

/**
 * Imports › Extractions DC › Règlements sur ordonnances (F2 · XRGV).
 */
class DcReglementsOrdonnancesService
{
    private const SOURCE = 'dc-regl';
    private const BATCH_INSERT = 250;

    /** Colonnes aperçu maquette (sof-data.js dc-regl). */
    public const COLS_APERCU = [
        'TYPE', 'TYPE_1', 'CATEG', 'EX', 'DAT_REGL', 'ORDONNANCE',
        'N_REGL', 'D_EMIS', 'MIN', 'MISSION', 'PROG', 'TITRE',
        'BOP', 'UO', 'PC', 'NAT', 'MDR', 'M_REGL', 'M_NET',
    ];

    /** Colonnes attendues export XRGV (F2). */
    private const COLS_F2 = [
        'TYPE', 'TYPE_1', 'CATEG', 'EX', 'DAT_REGL', 'ORDONNANCE', 'N_REGL',
        'D_EMIS', 'MIN', 'L_MIN', 'MISSION', 'L_MIS', 'PROG', 'ACTION',
        'TITRE', 'BOP', 'L_BOP', 'UO', 'L_UO', 'PC', 'LIB_PC', 'L_PROG',
        'NAT', 'NATURE', 'BANQUE', 'MDR', 'COMPTE_BANC', 'MATRIC', 'NOM',
        'M_REGL', 'M_NET', 'M_PREC_TVA', 'N_MANDAT_TVA', 'OBJET', 'NUM_BV',
        'N_CBANQ', 'D_ECHE',
    ];

    public function __construct(
        private readonly ScriptPoolSof $scriptPoolSof,
        private readonly PeriodeRepository $periodeRepository,
        private readonly LotImportRepository $lotImportRepository,
        private readonly DcReglementRepository $dcReglementRepository,
        private readonly LotImportService $lotImportService,
        private readonly EntityManagerInterface $em,
        private readonly Security $security,
        private readonly JournalAuditService $journalAuditService,
    ) {
    }

    /**
     * @return array<string, mixed>
     */
    public function obtenirEtat(?int $periodeId = null, int $page = 1, int $pageSize = 20): array
    {
        $page = max(1, $page);
        $pageSize = min(100, max(1, $pageSize));

        $vide = function (?array $periode) use ($pageSize): array {
            return [
                'format' => FormatImport::F2->value,
                'source' => self::SOURCE,
                'periode' => $periode,
                'compte' => '',
                'nature' => '',
                'colonnes' => self::COLS_APERCU,
                'colonnes_attendues' => self::COLS_F2,
                'lot' => null,
                'lignes' => [],
                'anomalies' => [],
                'nombre' => 0,
                'total' => '0.00',
                'premiere_date' => null,
                'derniere_date' => null,
                'vs_precedent' => null,
                'page' => 1,
                'page_size' => $pageSize,
                'pages' => 0,
                'message' => null,
            ];
        };

        $periode = $this->resoudrePeriode($periodeId);
        if (!$periode instanceof Periode || $periode->getId() === null) {
            $out = $vide(null);
            $out['message'] = 'Aucune période SROT.';

            return $out;
        }

        $lot = $this->trouverLotActif($periode->getId());
        if (!$lot instanceof LotImport || $lot->getId() === null) {
            return $vide($this->serialiserPeriode($periode));
        }

        $nombre = $this->dcReglementRepository->compterParLot($lot->getId());
        if ($nombre <= 0) {
            $params = $lot->getParametres();
            $annonce = $lot->getNbLignes() > 0
                ? 'Lot incomplet : les lignes n’ont pas été enregistrées. Relancez l’import.'
                : null;

            return [
                'format' => FormatImport::F2->value,
                'source' => self::SOURCE,
                'periode' => $this->serialiserPeriode($periode),
                'compte' => '',
                'nature' => '',
                'colonnes' => self::COLS_APERCU,
                'colonnes_attendues' => self::COLS_F2,
                'lot' => $this->lotImportService->obtenir($lot->getId()),
                'lignes' => [],
                'anomalies' => $this->lotImportService->listerAnomalies($lot->getId()),
                'nombre' => 0,
                'total' => '0.00',
                'premiere_date' => $params['premiere_date'] ?? null,
                'derniere_date' => $params['derniere_date'] ?? null,
                'vs_precedent' => null,
                'page' => 1,
                'page_size' => $pageSize,
                'pages' => 0,
                'message' => $annonce,
            ];
        }

        $pages = (int) max(1, (int) ceil($nombre / $pageSize));
        if ($page > $pages) {
            $page = $pages;
        }

        $offset = ($page - 1) * $pageSize;
        $lignes = $this->dcReglementRepository->listerTableauParLot($lot->getId(), $pageSize, $offset);
        $params = $lot->getParametres();

        return [
            'format' => FormatImport::F2->value,
            'source' => self::SOURCE,
            'periode' => $this->serialiserPeriode($periode),
            'compte' => '',
            'nature' => '',
            'colonnes' => self::COLS_APERCU,
            'colonnes_attendues' => self::COLS_F2,
            'lot' => $this->lotImportService->obtenir($lot->getId()),
            'lignes' => array_map(fn (array $ligne): array => $this->serialiserLigne($ligne), $lignes),
            'anomalies' => $this->lotImportService->listerAnomalies($lot->getId()),
            'nombre' => $nombre,
            'total' => $lot->getMontantTotal(),
            'premiere_date' => $params['premiere_date'] ?? null,
            'derniere_date' => $params['derniere_date'] ?? null,
            'vs_precedent' => $this->vsPrecedent($periode->getId(), $nombre),
            'page' => $page,
            'page_size' => $pageSize,
            'pages' => $pages,
            'message' => null,
        ];
    }

    /**
     * @return array{pct: float, libelle: string, alerte: bool}|null
     */
    private function vsPrecedent(int $periodeId, int $nbActuel): ?array
    {
        /** @var list<LotImport> $remplaces */
        $remplaces = $this->lotImportRepository->createQueryBuilder('l')
            ->andWhere('IDENTITY(l.periode) = :pid')
            ->andWhere('l.format = :format')
            ->andWhere('l.statut = :st')
            ->setParameter('pid', $periodeId)
            ->setParameter('format', FormatImport::F2)
            ->setParameter('st', StatutLotImport::REMPLACE)
            ->orderBy('l.importeLe', 'DESC')
            ->setMaxResults(5)
            ->getQuery()
            ->getResult();

        $precedent = null;
        foreach ($remplaces as $lot) {
            $params = $lot->getParametres();
            if (($params['source'] ?? null) === self::SOURCE) {
                $precedent = $lot;
                break;
            }
        }

        if (!$precedent instanceof LotImport || $precedent->getNbLignes() <= 0) {
            return null;
        }

        $nbPrecedent = $precedent->getNbLignes();
        $pct = (($nbActuel - $nbPrecedent) / $nbPrecedent) * 100;
        $params = $precedent->getParametres();
        $mois = $params['date_fin'] ?? null;
        $libelle = 'Import précédent';
        if (\is_string($mois) && preg_match('/^(\d{4})-(\d{2})/', $mois, $m)) {
            $moisNom = Mois::tryFrom((int) $m[2])?->libelle();
            $libelle = ($moisNom ? ucfirst($moisNom) : $m[2]).' '.$m[1];
        }

        return [
            'pct' => round($pct, 1),
            'libelle' => $libelle,
            'alerte' => $pct < -30,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function importerOracle(string $dateDebut, string $dateFin, ?int $periodeId = null): array
    {
        $this->preparerImportVolumineux();
        [$debut, $fin] = $this->validerPeriode($dateDebut, $dateFin);
        $periode = $this->resoudrePeriode($periodeId, $fin);
        if (!$periode instanceof Periode || $periode->getId() === null) {
            throw new DonneesInvalidesException(sprintf(
                'Aucune période SROT pour %s %d.',
                Mois::tryFrom((int) $fin->format('n'))?->libelle() ?? $fin->format('m'),
                (int) $fin->format('Y'),
            ));
        }

        try {
            $brutes = $this->scriptPoolSof->extraireDepensesReglementsOrdonnancesXrgv(
                $debut->format('d/m/Y'),
                $fin->format('d/m/Y'),
            );
        } catch (\Throwable $e) {
            throw new DonneesInvalidesException(
                'Extraction DC règlements sur ordonnances impossible : '.$e->getMessage(),
            );
        }

        $normalisees = [];
        foreach ($brutes as $i => $ligne) {
            $normalisee = $this->normaliserOracle($ligne);
            $normalisee['_ligne_source'] = $i + 2;
            $normalisees[] = $normalisee;
        }
        unset($brutes);

        return $this->persisterLot(
            $periode,
            $normalisees,
            $debut,
            $fin,
            'oracle',
            sprintf('xrgv_oracle_%s_%s', $debut->format('Ymd'), $fin->format('Ymd')),
            null,
        );
    }

    /**
     * @return array<string, mixed>
     */
    public function importerExcel(
        UploadedFile $fichier,
        ?int $periodeId = null,
        ?string $dateDebut = null,
        ?string $dateFin = null,
    ): array {
        $this->preparerImportVolumineux();
        $periode = $this->resoudrePeriode($periodeId);
        if (!$periode instanceof Periode || $periode->getId() === null) {
            throw new DonneesInvalidesException('Aucune période SROT.');
        }

        if ($dateDebut !== null && $dateDebut !== '' && $dateFin !== null && $dateFin !== '') {
            [$debut, $fin] = $this->validerPeriode($dateDebut, $dateFin);
        } else {
            $annee = $periode->getExercice()->getAnnee();
            $mois = $periode->getMois();
            $debut = new \DateTimeImmutable(sprintf('%04d-01-01', $annee));
            $fin = new \DateTimeImmutable(sprintf(
                '%04d-%02d-%02d',
                $annee,
                $mois,
                (int) (new \DateTimeImmutable(sprintf('%04d-%02d-01', $annee, $mois)))->format('t'),
            ));
        }

        $ext = strtolower($fichier->getClientOriginalExtension() ?: '');
        if (!\in_array($ext, ['xlsx', 'xls', 'csv'], true)) {
            throw new DonneesInvalidesException('Fichier attendu : Excel (.xlsx / .xls) ou CSV.');
        }

        try {
            $spreadsheet = IOFactory::load($fichier->getPathname());
        } catch (\Throwable $e) {
            throw new DonneesInvalidesException('Impossible de lire le fichier Excel : '.$e->getMessage());
        }

        $sheet = $spreadsheet->getActiveSheet();
        $rows = $sheet->toArray(null, true, true, false);
        if ($rows === []) {
            throw new DonneesInvalidesException('Fichier Excel vide.');
        }

        $headerRow = null;
        $headerIndex = 0;
        foreach ($rows as $i => $row) {
            $map = $this->mapperEnTetes(array_map(static fn ($c) => (string) ($c ?? ''), $row));
            if (isset($map['ORDONNANCE']) || isset($map['N_REGL']) || isset($map['DAT_REGL'])) {
                $headerRow = $map;
                $headerIndex = (int) $i;
                break;
            }
        }

        if ($headerRow === null) {
            throw new DonneesInvalidesException(
                'En-têtes XRGV introuvables (attendu ORDONNANCE, N_REGL, DAT_REGL…).',
            );
        }

        $normalisees = [];
        for ($i = $headerIndex + 1, $n = count($rows); $i < $n; ++$i) {
            $row = $rows[$i];
            if (!\is_array($row) || $this->ligneVide($row)) {
                continue;
            }

            $assoc = [];
            foreach ($headerRow as $col => $idx) {
                $assoc[$col] = $row[$idx] ?? null;
            }
            $normalisee = $this->normaliserExcel($assoc);
            $normalisee['_ligne_source'] = $i + 1;
            $normalisees[] = $normalisee;
        }

        $sha = hash_file('sha256', $fichier->getPathname()) ?: null;

        return $this->persisterLot(
            $periode,
            $normalisees,
            $debut,
            $fin,
            'excel',
            $fichier->getClientOriginalName() ?: 'regl.xlsx',
            $sha,
        );
    }

    private function preparerImportVolumineux(): void
    {
        if (\function_exists('ini_set')) {
            @ini_set('memory_limit', '512M');
        }
        @set_time_limit(300);
    }

    /**
     * @param list<array<string, mixed>> $lignes
     *
     * @return array<string, mixed>
     */
    private function persisterLot(
        Periode $periode,
        array $lignes,
        \DateTimeImmutable $debut,
        \DateTimeImmutable $fin,
        string $mode,
        string $fichierNom,
        ?string $fichierSha,
    ): array {
        $this->preparerImportVolumineux();

        $pid = $periode->getId() ?? 0;
        $acteur = $this->acteur();
        $acceptees = [];
        $anomalies = [];
        $vus = [];
        $total = '0.00';
        $premiere = null;
        $derniere = null;

        foreach ($lignes as $i => $ligne) {
            $numLigne = (int) ($ligne['_ligne_source'] ?? ($i + 2));
            $ordonnance = trim((string) ($ligne['ordonnance'] ?? ''));
            $nRegl = trim((string) ($ligne['n_regl'] ?? ''));

            if ($ordonnance !== '' && $nRegl !== '') {
                $cle = mb_strtoupper($ordonnance).'|'.mb_strtoupper($nRegl);
                if (isset($vus[$cle])) {
                    $anomalies[] = [
                        'ligne' => $numLigne,
                        'colonne' => 'ORDONNANCE + N_REGL',
                        'motif' => sprintf(
                            'Doublon ordonnance + règlement (%s / %s) : première occurrence conservée (ligne %d).',
                            $ordonnance,
                            $nRegl,
                            (int) $vus[$cle],
                        ),
                    ];
                    continue;
                }
                $vus[$cle] = $numLigne;
            }

            $montant = $this->montantOuZero($ligne['m_regl'] ?? null);
            $ligne['m_regl'] = $montant;
            $total = bcadd($total, $montant, 2);

            $date = $ligne['dat_regl_obj'] ?? null;
            if ($date instanceof \DateTimeImmutable) {
                if ($premiere === null || $date < $premiere) {
                    $premiere = $date;
                }
                if ($derniere === null || $date > $derniere) {
                    $derniere = $date;
                }
            }

            $acceptees[] = $ligne;
        }
        unset($lignes);

        $nbAcceptees = \count($acceptees);

        /** @var int $lotId */
        $lotId = $this->em->wrapInTransaction(function () use (
            $periode,
            $pid,
            $mode,
            $fichierNom,
            $fichierSha,
            $acteur,
            $acceptees,
            $anomalies,
            $total,
            $debut,
            $fin,
            $premiere,
            $derniere,
            $nbAcceptees,
        ): int {
            foreach ($this->listerLotsActifs($pid) as $ancien) {
                $ancien->setStatut(StatutLotImport::REMPLACE);
            }
            $this->em->flush();

            $lot = new LotImport($periode, FormatImport::F2, [
                'source' => self::SOURCE,
                'source_libelle' => 'Règlements sur ordonnances (DC · XRGV)',
                'etape' => 'sof_dc_reglement',
                'mode' => $mode,
                'date_debut' => $debut->format('Y-m-d'),
                'date_fin' => $fin->format('Y-m-d'),
                'premiere_date' => $premiere?->format('Y-m-d'),
                'derniere_date' => $derniere?->format('Y-m-d'),
            ]);
            $lot->setNbLignes(0);
            $lot->setMontantTotal($total);
            $lot->setFichierNom($fichierNom);
            if ($fichierSha !== null) {
                $lot->setFichierSha256($fichierSha);
            }
            if ($acteur instanceof Utilisateur) {
                $lot->setImportePar($acteur);
            }
            $this->em->persist($lot);
            $this->em->flush();

            $id = $lot->getId();
            if ($id === null) {
                throw new DonneesInvalidesException('Échec de création du lot d’import.');
            }

            $nbPersistees = $this->insererReglementsSql($id, $acceptees);

            foreach ($anomalies as $a) {
                $colonne = $a['colonne'] ?? null;
                $this->em->persist(new AnomalieImport(
                    $lot,
                    (int) $a['ligne'],
                    (string) $a['motif'],
                    \is_string($colonne) && $colonne !== '' ? $colonne : null,
                ));
            }
            $this->em->flush();

            if ($nbPersistees !== $nbAcceptees) {
                throw new DonneesInvalidesException(sprintf(
                    'Import incomplet : %d ligne(s) attendue(s), %d enregistrée(s).',
                    $nbAcceptees,
                    $nbPersistees,
                ));
            }

            $lot->setNbLignes($nbPersistees);
            $this->em->flush();

            return $id;
        });

        $this->journalAuditService->enregistrer(
            'IMPORTER',
            'sof_dc_reglement',
            'reglements-ordonnances/'.$pid,
            $acteur,
            null,
            [
                'mode' => $mode,
                'lot_id' => $lotId,
                'nb_lignes' => $nbAcceptees,
                'nb_anomalies' => \count($anomalies),
                'montant_total' => $total,
            ],
        );

        $etat = $this->obtenirEtat($pid, 1, 20);
        $etat['nb_anomalies'] = \count($anomalies);
        $etat['message'] = null;

        return $etat;
    }

    /**
     * Insert SQL multi-valeurs pour les volumes XRGV.
     *
     * @param list<array<string, mixed>> $lignes
     */
    private function insererReglementsSql(int $lotId, array $lignes): int
    {
        if ($lignes === []) {
            return 0;
        }

        $conn = $this->em->getConnection();
        $cols = 'lot_id, type, type_1, categ, ex, dat_regl, ordonnance, n_regl, d_emis, min, l_min, mission, l_mis, prog, l_prog, action, titre, bop, l_bop, uo, l_uo, pc, lib_pc, nat, nature, banque, mdr, compte_banc, matric, nom, m_regl, m_net, m_prec_tva, n_mandat_tva, objet, num_bv, n_cbanq, d_eche';
        $inseres = 0;

        foreach (array_chunk($lignes, self::BATCH_INSERT) as $chunk) {
            $placeholders = [];
            $params = [];
            $i = 0;

            foreach ($chunk as $ligne) {
                $placeholders[] = sprintf(
                    '(:lot%d,:type%d,:type_1_%d,:categ%d,:ex%d,:dat_regl%d,:ordonnance%d,:n_regl%d,:d_emis%d,:min%d,:l_min%d,:mission%d,:l_mis%d,:prog%d,:l_prog%d,:action%d,:titre%d,:bop%d,:l_bop%d,:uo%d,:l_uo%d,:pc%d,:lib_pc%d,:nat%d,:nature%d,:banque%d,:mdr%d,:compte_banc%d,:matric%d,:nom%d,:m_regl%d,:m_net%d,:m_prec_tva%d,:n_mandat_tva%d,:objet%d,:num_bv%d,:n_cbanq%d,:d_eche%d)',
                    $i,
                    $i,
                    $i,
                    $i,
                    $i,
                    $i,
                    $i,
                    $i,
                    $i,
                    $i,
                    $i,
                    $i,
                    $i,
                    $i,
                    $i,
                    $i,
                    $i,
                    $i,
                    $i,
                    $i,
                    $i,
                    $i,
                    $i,
                    $i,
                    $i,
                    $i,
                    $i,
                    $i,
                    $i,
                    $i,
                    $i,
                    $i,
                    $i,
                    $i,
                    $i,
                    $i,
                    $i,
                    $i,
                );

                $params["lot$i"] = $lotId;
                $params["type$i"] = $this->tronquer((string) ($ligne['type'] ?? ''), 32);
                $params["type_1_$i"] = $this->tronquer((string) ($ligne['type_1'] ?? ''), 32);
                $params["categ$i"] = $this->tronquer((string) ($ligne['categ'] ?? ''), 32);
                $params["ex$i"] = $this->tronquer((string) ($ligne['ex'] ?? ''), 8);
                $params["dat_regl$i"] = $this->dateSql($ligne['dat_regl_obj'] ?? null);
                $params["ordonnance$i"] = $this->tronquer((string) ($ligne['ordonnance'] ?? ''), 32);
                $params["n_regl$i"] = $this->tronquer((string) ($ligne['n_regl'] ?? ''), 32);
                $params["d_emis$i"] = $this->dateSql($ligne['d_emis_obj'] ?? null);
                $params["min$i"] = $this->tronquer((string) ($ligne['min'] ?? ''), 16);
                $params["l_min$i"] = $this->tronquer((string) ($ligne['l_min'] ?? ''), 255);
                $params["mission$i"] = $this->tronquer((string) ($ligne['mission'] ?? ''), 32);
                $params["l_mis$i"] = $this->tronquer((string) ($ligne['l_mis'] ?? ''), 255);
                $params["prog$i"] = $this->tronquer((string) ($ligne['prog'] ?? ''), 32);
                $params["l_prog$i"] = $this->tronquer((string) ($ligne['l_prog'] ?? ''), 255);
                $params["action$i"] = $this->tronquer((string) ($ligne['action'] ?? ''), 32);
                $params["titre$i"] = $this->tronquer((string) ($ligne['titre'] ?? ''), 16);
                $params["bop$i"] = $this->tronquer((string) ($ligne['bop'] ?? ''), 32);
                $params["l_bop$i"] = $this->tronquer((string) ($ligne['l_bop'] ?? ''), 255);
                $params["uo$i"] = $this->tronquer((string) ($ligne['uo'] ?? ''), 32);
                $params["l_uo$i"] = $this->tronquer((string) ($ligne['l_uo'] ?? ''), 255);
                $params["pc$i"] = $this->tronquer((string) ($ligne['pc'] ?? ''), 16);
                $params["lib_pc$i"] = $this->tronquer((string) ($ligne['lib_pc'] ?? ''), 255);
                $params["nat$i"] = $this->tronquer((string) ($ligne['nat'] ?? ''), 16);
                $params["nature$i"] = $this->tronquer((string) ($ligne['nature'] ?? ''), 255);
                $params["banque$i"] = $this->tronquer((string) ($ligne['banque'] ?? ''), 64);
                $params["mdr$i"] = $this->tronquer((string) ($ligne['mdr'] ?? ''), 16);
                $params["compte_banc$i"] = $this->tronquer((string) ($ligne['compte_banc'] ?? ''), 64);
                $params["matric$i"] = $this->tronquer((string) ($ligne['matric'] ?? ''), 64);
                $params["nom$i"] = $this->tronquer((string) ($ligne['nom'] ?? ''), 255);
                $params["m_regl$i"] = $this->montantOuZero($ligne['m_regl'] ?? null);
                $params["m_net$i"] = $this->montantNullable($ligne['m_net'] ?? null);
                $params["m_prec_tva$i"] = $this->montantNullable($ligne['m_prec_tva'] ?? null);
                $params["n_mandat_tva$i"] = $this->tronquer((string) ($ligne['n_mandat_tva'] ?? ''), 32);
                $params["objet$i"] = $this->tronquer((string) ($ligne['objet'] ?? ''), 500);
                $params["num_bv$i"] = $this->tronquer((string) ($ligne['num_bv'] ?? ''), 64);
                $params["n_cbanq$i"] = $this->tronquer((string) ($ligne['n_cbanq'] ?? ''), 64);
                $params["d_eche$i"] = $this->dateSql($ligne['d_eche_obj'] ?? null);
                ++$i;
            }

            $conn->executeStatement(
                'INSERT INTO sof_dc_reglement ('.$cols.') VALUES '.implode(',', $placeholders),
                $params,
            );
            $inseres += \count($chunk);
        }

        return $inseres;
    }

    private function dateSql(mixed $value): ?string
    {
        return $value instanceof \DateTimeInterface ? $value->format('Y-m-d') : null;
    }

    private function tronquer(string $value, int $max): ?string
    {
        $value = trim($value);
        if ($value === '') {
            return null;
        }

        return mb_strlen($value) > $max ? mb_substr($value, 0, $max) : $value;
    }

    /**
     * @param array<string, mixed> $ligne
     *
     * @return array<string, mixed>
     */
    private function serialiserLigne(array $ligne): array
    {
        $dates = ['dat_regl', 'd_emis', 'd_eche'];
        foreach ($dates as $colonne) {
            $valeur = $ligne[$colonne] ?? null;
            if ($valeur instanceof \DateTimeInterface) {
                $ligne[$colonne] = $valeur->format('Y-m-d');
            }
        }

        return $ligne;
    }

    /**
     * @param array<string, mixed> $ligne
     *
     * @return array<string, mixed>
     */
    private function normaliserOracle(array $ligne): array
    {
        return [
            'type' => $this->texte($this->cellule($ligne, 'TYPE')),
            'type_1' => $this->texte($this->cellule($ligne, 'TYPE_1', 'TYPE1')),
            'categ' => $this->texte($this->cellule($ligne, 'CATEG')),
            'ex' => $this->texte($this->cellule($ligne, 'EX')),
            'dat_regl_obj' => $this->parserDate($this->cellule($ligne, 'DAT_REGL', 'D_REGL')),
            'ordonnance' => $this->texte($this->cellule($ligne, 'ORDONNANCE')),
            'n_regl' => $this->texte($this->cellule($ligne, 'N_REGL')),
            'd_emis_obj' => $this->parserDate($this->cellule($ligne, 'D_EMIS')),
            'min' => $this->texte($this->cellule($ligne, 'MIN')),
            'l_min' => $this->texte($this->cellule($ligne, 'L_MIN')),
            'mission' => $this->texte($this->cellule($ligne, 'MISSION')),
            'l_mis' => $this->texte($this->cellule($ligne, 'L_MIS')),
            'prog' => $this->texte($this->cellule($ligne, 'PROG')),
            'action' => $this->texte($this->cellule($ligne, 'ACTION')),
            'titre' => $this->texte($this->cellule($ligne, 'TITRE')),
            'bop' => $this->texte($this->cellule($ligne, 'BOP')),
            'l_bop' => $this->texte($this->cellule($ligne, 'L_BOP')),
            'uo' => $this->texte($this->cellule($ligne, 'UO')),
            'l_uo' => $this->texte($this->cellule($ligne, 'L_UO')),
            'pc' => $this->texte($this->cellule($ligne, 'PC')),
            'lib_pc' => $this->texte($this->cellule($ligne, 'LIB_PC')),
            'l_prog' => $this->texte($this->cellule($ligne, 'L_PROG')),
            'nat' => $this->texte($this->cellule($ligne, 'NAT')),
            'nature' => $this->texte($this->cellule($ligne, 'NATURE')),
            'banque' => $this->texte($this->cellule($ligne, 'BANQUE')),
            'mdr' => $this->texte($this->cellule($ligne, 'MDR')),
            'compte_banc' => $this->texte($this->cellule($ligne, 'COMPTE_BANC')),
            'matric' => $this->texte($this->cellule($ligne, 'MATRIC')),
            'nom' => $this->texte($this->cellule($ligne, 'NOM')),
            'm_regl' => $this->montantOuZero($this->cellule($ligne, 'M_REGL')),
            'm_net' => $this->montantNullable($this->cellule($ligne, 'M_NET')),
            'm_prec_tva' => $this->montantNullable($this->cellule($ligne, 'M_PREC_TVA')),
            'n_mandat_tva' => $this->texte($this->cellule($ligne, 'N_MANDAT_TVA')),
            'objet' => $this->texte($this->cellule($ligne, 'OBJET')),
            'num_bv' => $this->texte($this->cellule($ligne, 'NUM_BV', 'N_BV')),
            'n_cbanq' => $this->texte($this->cellule($ligne, 'N_CBANQ')),
            'd_eche_obj' => $this->parserDate($this->cellule($ligne, 'D_ECHE')),
        ];
    }

    /**
     * @param array<string, mixed> $assoc
     *
     * @return array<string, mixed>
     */
    private function normaliserExcel(array $assoc): array
    {
        return [
            'type' => $this->texte($assoc['TYPE'] ?? null),
            'type_1' => $this->texte($assoc['TYPE_1'] ?? null),
            'categ' => $this->texte($assoc['CATEG'] ?? null),
            'ex' => $this->texte($assoc['EX'] ?? null),
            'dat_regl_obj' => $this->parserDate($assoc['DAT_REGL'] ?? null),
            'ordonnance' => $this->texte($assoc['ORDONNANCE'] ?? null),
            'n_regl' => $this->texte($assoc['N_REGL'] ?? null),
            'd_emis_obj' => $this->parserDate($assoc['D_EMIS'] ?? null),
            'min' => $this->texte($assoc['MIN'] ?? null),
            'l_min' => $this->texte($assoc['L_MIN'] ?? null),
            'mission' => $this->texte($assoc['MISSION'] ?? null),
            'l_mis' => $this->texte($assoc['L_MIS'] ?? null),
            'prog' => $this->texte($assoc['PROG'] ?? null),
            'action' => $this->texte($assoc['ACTION'] ?? null),
            'titre' => $this->texte($assoc['TITRE'] ?? null),
            'bop' => $this->texte($assoc['BOP'] ?? null),
            'l_bop' => $this->texte($assoc['L_BOP'] ?? null),
            'uo' => $this->texte($assoc['UO'] ?? null),
            'l_uo' => $this->texte($assoc['L_UO'] ?? null),
            'pc' => $this->texte($assoc['PC'] ?? null),
            'lib_pc' => $this->texte($assoc['LIB_PC'] ?? null),
            'l_prog' => $this->texte($assoc['L_PROG'] ?? null),
            'nat' => $this->texte($assoc['NAT'] ?? null),
            'nature' => $this->texte($assoc['NATURE'] ?? null),
            'banque' => $this->texte($assoc['BANQUE'] ?? null),
            'mdr' => $this->texte($assoc['MDR'] ?? null),
            'compte_banc' => $this->texte($assoc['COMPTE_BANC'] ?? null),
            'matric' => $this->texte($assoc['MATRIC'] ?? null),
            'nom' => $this->texte($assoc['NOM'] ?? null),
            'm_regl' => $this->montantOuZero($assoc['M_REGL'] ?? null),
            'm_net' => $this->montantNullable($assoc['M_NET'] ?? null),
            'm_prec_tva' => $this->montantNullable($assoc['M_PREC_TVA'] ?? null),
            'n_mandat_tva' => $this->texte($assoc['N_MANDAT_TVA'] ?? null),
            'objet' => $this->texte($assoc['OBJET'] ?? null),
            'num_bv' => $this->texte($assoc['NUM_BV'] ?? null),
            'n_cbanq' => $this->texte($assoc['N_CBANQ'] ?? null),
            'd_eche_obj' => $this->parserDate($assoc['D_ECHE'] ?? null),
        ];
    }

    /**
     * @param list<string> $cells
     *
     * @return array<string, int>
     */
    private function mapperEnTetes(array $cells): array
    {
        $aliases = [
            'TYPE' => ['TYPE'],
            'TYPE_1' => ['TYPE_1', 'TYPE1', 'TYPE 1'],
            'CATEG' => ['CATEG', 'CATEGORIE'],
            'EX' => ['EX', 'EXERCICE'],
            'DAT_REGL' => ['DAT_REGL', 'D_REGL', 'DATE_REGL'],
            'ORDONNANCE' => ['ORDONNANCE', 'N_EMIS', 'MANDAT'],
            'N_REGL' => ['N_REGL', 'NREGL', 'N_REGLEMENT'],
            'D_EMIS' => ['D_EMIS', 'DATE_EMIS'],
            'MIN' => ['MIN'],
            'L_MIN' => ['L_MIN', 'LIB_MIN'],
            'MISSION' => ['MISSION'],
            'L_MIS' => ['L_MIS', 'LIB_MISSION'],
            'PROG' => ['PROG', 'PROGRAMME'],
            'ACTION' => ['ACTION'],
            'TITRE' => ['TITRE'],
            'BOP' => ['BOP'],
            'L_BOP' => ['L_BOP', 'LIB_BOP'],
            'UO' => ['UO'],
            'L_UO' => ['L_UO', 'LIB_UO'],
            'PC' => ['PC'],
            'LIB_PC' => ['LIB_PC', 'LIBELLE_PC'],
            'L_PROG' => ['L_PROG', 'LIB_PROG'],
            'NAT' => ['NAT'],
            'NATURE' => ['NATURE', 'LIB_NAT'],
            'BANQUE' => ['BANQUE'],
            'MDR' => ['MDR'],
            'COMPTE_BANC' => ['COMPTE_BANC', 'COMPTE_BANCAIRE', 'N_COMPTE'],
            'MATRIC' => ['MATRIC', 'MATRICULE'],
            'NOM' => ['NOM', 'BENEFICIAIRE'],
            'M_REGL' => ['M_REGL', 'MONTANT', 'M_REGLEMENT'],
            'M_NET' => ['M_NET', 'MONTANT_NET'],
            'M_PREC_TVA' => ['M_PREC_TVA'],
            'N_MANDAT_TVA' => ['N_MANDAT_TVA', 'MANDAT_TVA'],
            'OBJET' => ['OBJET'],
            'NUM_BV' => ['NUM_BV', 'N_BV', 'BV'],
            'N_CBANQ' => ['N_CBANQ'],
            'D_ECHE' => ['D_ECHE', 'DATE_ECHEANCE'],
        ];

        $map = [];
        foreach ($cells as $i => $raw) {
            $norm = $this->normaliserEnTete($raw);
            if ($norm === '') {
                continue;
            }

            foreach ($aliases as $canon => $candidats) {
                if (isset($map[$canon])) {
                    continue;
                }
                foreach ($candidats as $candidat) {
                    if ($norm === $this->normaliserEnTete($candidat)) {
                        $map[$canon] = $i;
                        break 2;
                    }
                }
            }
        }

        return $map;
    }

    private function normaliserEnTete(string $value): string
    {
        $value = strtoupper(trim($value));
        $value = strtr($value, ['É' => 'E', 'È' => 'E', 'Ê' => 'E', 'À' => 'A', 'Ù' => 'U', 'Ô' => 'O', 'Î' => 'I', 'Ç' => 'C']);
        $value = preg_replace('/[^A-Z0-9]+/', '_', $value) ?? $value;

        return trim($value, '_');
    }

    /**
     * @param list<mixed> $row
     */
    private function ligneVide(array $row): bool
    {
        foreach ($row as $cellule) {
            if (trim((string) ($cellule ?? '')) !== '') {
                return false;
            }
        }

        return true;
    }

    /**
     * @return list<LotImport>
     */
    private function listerLotsActifs(int $periodeId): array
    {
        /** @var list<LotImport> $candidats */
        $candidats = $this->lotImportRepository->createQueryBuilder('l')
            ->andWhere('IDENTITY(l.periode) = :pid')
            ->andWhere('l.format = :format')
            ->andWhere('l.statut = :actif')
            ->setParameter('pid', $periodeId)
            ->setParameter('format', FormatImport::F2)
            ->setParameter('actif', StatutLotImport::ACTIF)
            ->orderBy('l.importeLe', 'DESC')
            ->getQuery()
            ->getResult();

        $out = [];
        foreach ($candidats as $lot) {
            $params = $lot->getParametres();
            $source = $params['source'] ?? null;
            if ($source === null || $source === self::SOURCE) {
                $out[] = $lot;
            }
        }

        if ($out === [] && $candidats !== []) {
            return $candidats;
        }

        return $out;
    }

    private function trouverLotActif(int $periodeId): ?LotImport
    {
        return $this->listerLotsActifs($periodeId)[0] ?? null;
    }

    private function resoudrePeriode(?int $periodeId, ?\DateTimeImmutable $dateRef = null): ?Periode
    {
        if ($periodeId !== null) {
            $periode = $this->periodeRepository->find($periodeId);

            return $periode instanceof Periode ? $periode : null;
        }

        if ($dateRef instanceof \DateTimeImmutable) {
            return $this->periodeRepository->trouver(
                (int) $dateRef->format('Y'),
                (int) $dateRef->format('n'),
            );
        }

        /** @var list<Periode> $periodes */
        $periodes = $this->periodeRepository->createQueryBuilder('p')
            ->orderBy('p.exercice', 'DESC')
            ->addOrderBy('p.mois', 'DESC')
            ->setMaxResults(1)
            ->getQuery()
            ->getResult();

        return ($periodes[0] ?? null) instanceof Periode ? $periodes[0] : null;
    }

    /**
     * @return array{0: \DateTimeImmutable, 1: \DateTimeImmutable}
     */
    private function validerPeriode(string $dateDebut, string $dateFin): array
    {
        $debut = $this->parserDate(trim($dateDebut));
        $fin = $this->parserDate(trim($dateFin));
        if (!$debut instanceof \DateTimeImmutable || !$fin instanceof \DateTimeImmutable) {
            throw new DonneesInvalidesException('Dates invalides (attendu AAAA-MM-JJ).');
        }
        if ($fin < $debut) {
            throw new DonneesInvalidesException('La date de fin doit être ≥ date de début.');
        }

        return [$debut, $fin];
    }

    private function parserDate(mixed $value): ?\DateTimeImmutable
    {
        if ($value instanceof \DateTimeImmutable) {
            return $value->setTime(0, 0);
        }
        if ($value instanceof \DateTimeInterface) {
            return \DateTimeImmutable::createFromInterface($value)->setTime(0, 0);
        }
        if (\is_numeric($value) && (float) $value > 20000) {
            try {
                $date = \PhpOffice\PhpSpreadsheet\Shared\Date::excelToDateTimeObject((float) $value);

                return \DateTimeImmutable::createFromMutable($date)->setTime(0, 0);
            } catch (\Throwable) {
                return null;
            }
        }

        $brut = trim((string) ($value ?? ''));
        if ($brut === '') {
            return null;
        }

        foreach (['Y-m-d', 'd/m/Y', 'd-m-Y'] as $format) {
            $date = \DateTimeImmutable::createFromFormat('!'.$format, $brut);
            if ($date instanceof \DateTimeImmutable) {
                $erreurs = \DateTimeImmutable::getLastErrors();
                if (($erreurs['warning_count'] ?? 0) === 0 && ($erreurs['error_count'] ?? 0) === 0) {
                    return $date;
                }
            }
        }

        return null;
    }

    /**
     * @return array<string, mixed>
     */
    private function serialiserPeriode(Periode $periode): array
    {
        $mois = $periode->getMois();

        return [
            'id' => $periode->getId(),
            'mois' => $mois,
            'exercice_annee' => $periode->getExercice()->getAnnee(),
            'mois_libelle' => Mois::tryFrom($mois)?->libelle(),
        ];
    }

    private function acteur(): ?Utilisateur
    {
        $utilisateur = $this->security->getUser();

        return $utilisateur instanceof Utilisateur ? $utilisateur : null;
    }

    /**
     * @param array<string, mixed> $ligne
     */
    private function cellule(array $ligne, string ...$cles): mixed
    {
        foreach ($cles as $cle) {
            foreach ($ligne as $k => $valeur) {
                if (strcasecmp((string) $k, $cle) === 0) {
                    return $valeur;
                }
            }
        }

        return null;
    }

    private function texte(mixed $value): ?string
    {
        if ($value === null) {
            return null;
        }

        $texte = trim((string) $value);
        if ($texte === '') {
            return null;
        }

        if (is_numeric($texte) && str_contains($texte, '.')) {
            $float = (float) $texte;
            if (abs($float - round($float)) < 1e-9) {
                $texte = (string) (int) round($float);
            }
        }

        return $texte;
    }

    private function montantOuZero(mixed $value): string
    {
        $montant = $this->montantNullable($value);

        return $montant ?? '0.00';
    }

    private function montantNullable(mixed $value): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }
        if (\is_int($value) || \is_float($value)) {
            return number_format((float) $value, 2, '.', '');
        }

        $texte = preg_replace('/[\s\x{00A0}\x{202F}\']+/u', '', (string) $value) ?? '';
        $texte = str_replace(',', '.', $texte);
        if ($texte === '' || !is_numeric($texte)) {
            return null;
        }

        return number_format((float) $texte, 2, '.', '');
    }
}
