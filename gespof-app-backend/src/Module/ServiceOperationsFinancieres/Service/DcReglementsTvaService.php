<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Service;

use App\Module\ServiceOperationsFinancieres\Entite\Import\AnomalieImport;
use App\Module\ServiceOperationsFinancieres\Entite\Import\DcMandat;
use App\Module\ServiceOperationsFinancieres\Entite\Import\LotImport;
use App\Module\ServiceOperationsFinancieres\Entite\Periode;
use App\Module\ServiceOperationsFinancieres\Enum\FormatImport;
use App\Module\ServiceOperationsFinancieres\Enum\Mois;
use App\Module\ServiceOperationsFinancieres\Enum\StatutLotImport;
use App\Module\ServiceOperationsFinancieres\Enum\TypeDcMandat;
use App\Module\ServiceOperationsFinancieres\Repository\DcMandatRepository;
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
 * Imports › Extractions DC › TVA :
 *  - Règlements TVA (F4 · XRGM → dc_mandat REGLE · source dc-tva)
 *  - RAP TVA (F5 · XRAM → dc_mandat RAP · source dc-rap-tva)
 */
class DcReglementsTvaService
{
    private const SOURCE = 'dc-tva';
    private const SOURCE_RAP = 'dc-rap-tva';
    private const COMPTE = '4781-31';
    private const NATURE = '81';
    /** Taille des INSERT SQL multi-valeurs (évite OOM profiler Doctrine en dev). */
    private const BATCH_INSERT = 250;

    /** Colonnes aperçu maquette (sof-data.js dc-tva). */
    public const COLS_APERCU = [
        'DAT_REGL', 'N_EMIS', 'N_REGL', 'D_EMIS', 'PC', 'MDR',
        'MATRIC', 'NOM', 'M_REGL', 'M_NET', 'NUM_BV',
    ];

    /** Colonnes aperçu maquette (sof-data.js dc-rap-tva). */
    public const COLS_APERCU_RAP = [
        'PC', 'MANDAT', 'D_EMIS', 'MDR', 'MATRIC', 'NOM',
        'RAP', 'D_VISA', 'OBJET', 'C_BLOCAG',
    ];

    /** Colonnes attendues export XRGM (plan F4). */
    private const COLS_F4 = [
        'DAT_REGL', 'N_EMIS', 'N_REGL', 'D_EMIS', 'COMPTE', 'LIB_COMPTE',
        'NAT', 'LIB_NAT', 'PC', 'LIB_PC', 'BANQUE', 'MDR', 'N_COMPTE',
        'MATRIC', 'NOM', 'M_REGL', 'M_NET', 'L_REF1', 'L_REF2', 'L_REF3',
        'L_REF4', 'NUM_BV', 'N_CBANQ',
    ];

    public function __construct(
        private readonly ScriptPoolSof $scriptPoolSof,
        private readonly PeriodeRepository $periodeRepository,
        private readonly LotImportRepository $lotImportRepository,
        private readonly DcMandatRepository $dcMandatRepository,
        private readonly LotImportService $lotImportService,
        private readonly EntityManagerInterface $em,
        private readonly Security $security,
        private readonly JournalAuditService $journalAuditService,
    ) {
    }

    /**
     * @return array<string, mixed>
     */
    public function obtenirEtat(
        ?int $periodeId = null,
        int $page = 1,
        int $pageSize = 20,
        TypeDcMandat $type = TypeDcMandat::REGLE,
    ): array {
        $page = max(1, $page);
        $pageSize = min(100, max(1, $pageSize));
        $colsApercu = $this->colonnesApercu($type);
        $colsAttendues = $this->colonnesAttendues($type);

        $vide = function (?array $periode) use ($pageSize, $type, $colsApercu, $colsAttendues): array {
            return [
                'type' => $type->value,
                'format' => $this->formatPour($type)->value,
                'source' => $this->sourcePour($type),
                'periode' => $periode,
                'compte' => self::COMPTE,
                'nature' => self::NATURE,
                'colonnes' => $colsApercu,
                'colonnes_attendues' => $colsAttendues,
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

        $lot = $this->trouverLotActif($periode->getId(), $type);
        if (!$lot instanceof LotImport || $lot->getId() === null) {
            return $vide($this->serialiserPeriode($periode));
        }

        // Compter uniquement les lignes réellement persistées (pas lot.nb_lignes,
        // qui peut rester renseigné après un flush partiel / OOM).
        $nombre = $this->dcMandatRepository->compterParLot($lot->getId());
        if ($nombre <= 0) {
            $params = $lot->getParametres();
            $annonce = $lot->getNbLignes() > 0
                ? 'Lot incomplet : les lignes n’ont pas été enregistrées. Relancez l’import.'
                : null;

            return [
                'type' => $type->value,
                'format' => $this->formatPour($type)->value,
                'source' => $this->sourcePour($type),
                'periode' => $this->serialiserPeriode($periode),
                'compte' => self::COMPTE,
                'nature' => self::NATURE,
                'colonnes' => $colsApercu,
                'colonnes_attendues' => $colsAttendues,
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
        $entites = $this->dcMandatRepository->listerParLot($lot->getId(), $pageSize, $offset);
        $lignes = array_map(fn (DcMandat $d): array => $this->serialiserLigne($d), $entites);
        $params = $lot->getParametres();

        return [
            'type' => $type->value,
            'format' => $this->formatPour($type)->value,
            'source' => $this->sourcePour($type),
            'periode' => $this->serialiserPeriode($periode),
            'compte' => self::COMPTE,
            'nature' => self::NATURE,
            'colonnes' => $colsApercu,
            'colonnes_attendues' => $colsAttendues,
            'lot' => $this->lotImportService->obtenir($lot->getId()),
            'lignes' => $lignes,
            'anomalies' => $this->lotImportService->listerAnomalies($lot->getId()),
            'nombre' => $nombre,
            'total' => $lot->getMontantTotal(),
            'premiere_date' => $params['premiere_date'] ?? null,
            'derniere_date' => $params['derniere_date'] ?? null,
            'vs_precedent' => $this->vsPrecedent($periode->getId(), $nombre, $type),
            'page' => $page,
            'page_size' => $pageSize,
            'pages' => $pages,
            'message' => null,
        ];
    }

    /**
     * @return array{pct: float, libelle: string, alerte: bool}|null
     */
    private function vsPrecedent(int $periodeId, int $nbActuel, TypeDcMandat $type): ?array
    {
        /** @var list<LotImport> $remplaces */
        $remplaces = $this->lotImportRepository->createQueryBuilder('l')
            ->andWhere('IDENTITY(l.periode) = :pid')
            ->andWhere('l.format = :format')
            ->andWhere('l.statut = :st')
            ->setParameter('pid', $periodeId)
            ->setParameter('format', $this->formatPour($type))
            ->setParameter('st', StatutLotImport::REMPLACE)
            ->orderBy('l.importeLe', 'DESC')
            ->setMaxResults(5)
            ->getQuery()
            ->getResult();

        $prev = null;
        foreach ($remplaces as $lot) {
            $p = $lot->getParametres();
            if (($p['source'] ?? null) === $this->sourcePour($type)) {
                $prev = $lot;
                break;
            }
        }
        if (!$prev instanceof LotImport || $prev->getNbLignes() <= 0) {
            return null;
        }

        $nbPrev = $prev->getNbLignes();
        $pct = (($nbActuel - $nbPrev) / $nbPrev) * 100;
        $params = $prev->getParametres();
        $mois = $params['date_fin'] ?? null;
        $libelle = 'Import précédent';
        if (\is_string($mois) && preg_match('/^(\d{4})-(\d{2})/', $mois, $m)) {
            $lib = Mois::tryFrom((int) $m[2])?->libelle();
            $libelle = ($lib ? ucfirst($lib) : $m[2]).' '.$m[1];
        }

        return [
            'pct' => round($pct, 1),
            'libelle' => $libelle,
            'alerte' => $pct < -30,
        ];
    }

    /**
     * Extraction Oracle (XRGM équivalent) → lot F4 ACTIF.
     *
     * @return array<string, mixed>
     */
    public function importerOracle(
        string $dateDebut,
        string $dateFin,
        ?int $periodeId = null,
        TypeDcMandat $type = TypeDcMandat::REGLE,
    ): array {
        $this->preparerImportVolumineux();
        [$debut, $fin] = $this->validerPeriode($dateDebut, $dateFin);
        $periode = $this->resoudrePeriode($periodeId, $fin);
        if (!$periode instanceof Periode || $periode->getId() === null) {
            throw new DonneesInvalidesException(
                sprintf(
                    'Aucune période SROT pour %s %d.',
                    Mois::tryFrom((int) $fin->format('n'))?->libelle() ?? $fin->format('m'),
                    (int) $fin->format('Y'),
                ),
            );
        }

        try {
            $brutes = $type === TypeDcMandat::RAP
                ? $this->scriptPoolSof->extraireDepensesResteAPayer478131(
                    $debut->format('d/m/Y'),
                    $fin->format('d/m/Y'),
                )
                : $this->scriptPoolSof->extraireDepensesRemboursementsTvaExercice(
                    $debut->format('d/m/Y'),
                    $fin->format('d/m/Y'),
                );
        } catch (\Throwable $e) {
            throw new DonneesInvalidesException(
                ($type === TypeDcMandat::RAP ? 'Extraction DC RAP TVA impossible : ' : 'Extraction DC règlements TVA impossible : ')
                .$e->getMessage(),
            );
        }

        $normalisees = [];
        foreach ($brutes as $ligne) {
            $normalisees[] = $type === TypeDcMandat::RAP
                ? $this->normaliserOracleRap($ligne)
                : $this->normaliserOracle($ligne);
        }
        unset($brutes);

        return $this->persisterLot(
            $periode,
            $normalisees,
            $debut,
            $fin,
            'oracle',
            sprintf(
                '%s_oracle_%s_%s',
                $type === TypeDcMandat::RAP ? 'xram' : 'xrgm',
                $debut->format('Ymd'),
                $fin->format('Ymd'),
            ),
            null,
            $type,
        );
    }

    /**
     * Import fichier Excel XRGM → lot F4 ACTIF.
     *
     * @return array<string, mixed>
     */
    public function importerExcel(
        UploadedFile $fichier,
        ?int $periodeId = null,
        ?string $dateDebut = null,
        ?string $dateFin = null,
        TypeDcMandat $type = TypeDcMandat::REGLE,
    ): array {
        $this->preparerImportVolumineux();
        $periode = $this->resoudrePeriode($periodeId);
        if (!$periode instanceof Periode || $periode->getId() === null) {
            throw new DonneesInvalidesException('Aucune période SROT.');
        }

        $debut = null;
        $fin = null;
        if ($dateDebut !== null && $dateDebut !== '' && $dateFin !== null && $dateFin !== '') {
            [$debut, $fin] = $this->validerPeriode($dateDebut, $dateFin);
        } else {
            $annee = $periode->getExercice()->getAnnee();
            $mois = $periode->getMois();
            $debut = new \DateTimeImmutable(sprintf('%04d-01-01', $annee));
            $fin = new \DateTimeImmutable(sprintf('%04d-%02d-%02d', $annee, $mois, (int) (new \DateTimeImmutable(sprintf('%04d-%02d-01', $annee, $mois)))->format('t')));
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
            $trouve = $type === TypeDcMandat::RAP
                ? (isset($map['RAP']) || isset($map['N_EMIS']))
                : (isset($map['N_EMIS']) || isset($map['DAT_REGL']) || isset($map['M_REGL']));
            if ($trouve) {
                $headerRow = $map;
                $headerIndex = (int) $i;
                break;
            }
        }
        if ($headerRow === null) {
            throw new DonneesInvalidesException(
                $type === TypeDcMandat::RAP
                    ? 'En-têtes XRAM introuvables (attendu PC, MANDAT, D_EMIS, RAP…).'
                    : 'En-têtes XRGM introuvables (attendu DAT_REGL, N_EMIS, M_REGL…).',
            );
        }
        if ($type === TypeDcMandat::RAP && (!isset($headerRow['N_EMIS']) || !isset($headerRow['RAP']))) {
            throw new DonneesInvalidesException(
                'Colonnes XRAM obligatoires manquantes : MANDAT et RAP.',
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
            $normalisees[] = $type === TypeDcMandat::RAP
                ? $this->normaliserExcelRap($assoc)
                : $this->normaliserExcel($assoc);
        }

        $sha = hash_file('sha256', $fichier->getPathname()) ?: null;

        return $this->persisterLot(
            $periode,
            $normalisees,
            $debut,
            $fin,
            'excel',
            $fichier->getClientOriginalName() ?: ($type === TypeDcMandat::RAP ? 'xram.xlsx' : 'xrgm.xlsx'),
            $sha,
            $type,
        );
    }

    /**
     * @param list<array<string, mixed>> $lignes
     *
     * @return array<string, mixed>
     */
    private function preparerImportVolumineux(): void
    {
        if (\function_exists('ini_set')) {
            @ini_set('memory_limit', '512M');
        }
        @set_time_limit(300);
    }

    private function persisterLot(
        Periode $periode,
        array $lignes,
        \DateTimeImmutable $debut,
        \DateTimeImmutable $fin,
        string $mode,
        string $fichierNom,
        ?string $fichierSha,
        TypeDcMandat $type = TypeDcMandat::REGLE,
    ): array {
        $this->preparerImportVolumineux();

        $pid = $periode->getId() ?? 0;
        $acteur = $this->acteur();

        $acceptees = [];
        $anomalies = [];
        $total = '0.00';
        $premiere = null;
        $derniere = null;

        foreach ($lignes as $i => $l) {
            $numLigne = $i + 2;
            $compte = $this->normaliserCompte((string) ($l['compte'] ?? ''));
            $nat = $this->normaliserNature((string) ($l['nat'] ?? ''));

            if ($compte !== '' && $compte !== self::COMPTE) {
                $anomalies[] = ['ligne' => $numLigne, 'colonne' => 'COMPTE', 'motif' => 'Compte différent de 4781-31 (« '.$compte.' ») — ligne rejetée'];
                continue;
            }
            if ($nat !== '' && $nat !== self::NATURE) {
                $anomalies[] = ['ligne' => $numLigne, 'colonne' => 'NAT', 'motif' => 'Nature différente de 81 (« '.$nat.' ») — ligne rejetée'];
                continue;
            }
            // Excel sans colonnes compte/nat : on force le filtre métier
            if ($compte === '') {
                $l['compte'] = self::COMPTE;
            }
            if ($nat === '') {
                $l['nat'] = self::NATURE;
            }

            $montant = (string) ($l['montant'] ?? '0.00');
            $total = bcadd($total, $montant, 2);
            $dat = $type === TypeDcMandat::RAP
                ? ($l['d_emis_obj'] ?? null)
                : ($l['dat_regl_obj'] ?? null);
            if ($dat instanceof \DateTimeImmutable) {
                if ($premiere === null || $dat < $premiere) {
                    $premiere = $dat;
                }
                if ($derniere === null || $dat > $derniere) {
                    $derniere = $dat;
                }
            }
            $acceptees[] = $l;
        }
        unset($lignes);

        $nbAcceptees = \count($acceptees);

        /** @var int $lotId */
        $lotId = $this->em->wrapInTransaction(function () use (
            $periode,
            $pid,
            $type,
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
            foreach ($this->listerLotsActifs($pid, $type) as $ancien) {
                $ancien->setStatut(StatutLotImport::REMPLACE);
            }
            $this->em->flush();

            $lot = new LotImport($periode, $this->formatPour($type), [
                'source' => $this->sourcePour($type),
                'source_libelle' => $type === TypeDcMandat::RAP ? 'RAP TVA (DC · XRAM)' : 'Règlements TVA (DC · XRGM)',
                'etape' => 'dc_mandat',
                'type' => $type->value,
                'compte' => self::COMPTE,
                'nature' => self::NATURE,
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

            $nbPersistees = $this->insererMandatsSql($id, $type, $acceptees);

            foreach ($anomalies as $a) {
                $col = $a['colonne'] ?? null;
                $this->em->persist(new AnomalieImport(
                    $lot,
                    (int) $a['ligne'],
                    (string) $a['motif'],
                    \is_string($col) && $col !== '' ? $col : null,
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
            'dc_mandat',
            ($type === TypeDcMandat::RAP ? 'rap-tva/' : 'reglements-tva/').$pid,
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

        $etat = $this->obtenirEtat($pid, 1, 20, $type);
        $etat['nb_anomalies'] = \count($anomalies);
        $etat['message'] = null;

        return $etat;
    }

    /**
     * Insert SQL multi-valeurs — bien plus léger que l’ORM sur 6k+ lignes (évite OOM du profiler).
     *
     * @param list<array<string, mixed>> $lignes
     */
    private function insererMandatsSql(int $lotId, TypeDcMandat $type, array $lignes): int
    {
        if ($lignes === []) {
            return 0;
        }

        $conn = $this->em->getConnection();
        $cols = 'lot_id, type, n_emis, n_regl, d_emis, dat_regl, compte, nat, pc, mdr, matric, nom, montant, m_net, d_visa, objet, c_blocag, orig, num_bv';
        $inseres = 0;
        $estRap = $type === TypeDcMandat::RAP;

        foreach (array_chunk($lignes, self::BATCH_INSERT) as $chunk) {
            $placeholders = [];
            $params = [];
            $i = 0;
            foreach ($chunk as $l) {
                $placeholders[] = sprintf(
                    '(:lot%d,:type%d,:n_emis%d,:n_regl%d,:d_emis%d,:dat_regl%d,:compte%d,:nat%d,:pc%d,:mdr%d,:matric%d,:nom%d,:montant%d,:m_net%d,:d_visa%d,:objet%d,:c_blocag%d,:orig%d,:num_bv%d)',
                    $i, $i, $i, $i, $i, $i, $i, $i, $i, $i, $i, $i, $i, $i, $i, $i, $i, $i, $i,
                );
                $params["lot$i"] = $lotId;
                $params["type$i"] = $type->value;
                $params["n_emis$i"] = $this->tronquer((string) ($l['n_emis'] ?? ''), 32);
                $params["n_regl$i"] = $estRap ? null : $this->tronquer((string) ($l['n_regl'] ?? ''), 32);
                $params["d_emis$i"] = $this->dateSql($l['d_emis_obj'] ?? null);
                $params["dat_regl$i"] = $estRap ? null : $this->dateSql($l['dat_regl_obj'] ?? null);
                $params["compte$i"] = $this->tronquer((string) ($l['compte'] ?? self::COMPTE), 32);
                $params["nat$i"] = $this->tronquer((string) ($l['nat'] ?? self::NATURE), 16);
                $params["pc$i"] = $this->tronquer((string) ($l['pc'] ?? ''), 16);
                $params["mdr$i"] = $this->tronquer((string) ($l['mdr'] ?? ''), 16);
                $params["matric$i"] = $this->tronquer((string) ($l['matric'] ?? ''), 64);
                $params["nom$i"] = $this->tronquer((string) ($l['nom'] ?? ''), 255);
                $params["montant$i"] = (string) ($l['montant'] ?? '0.00');
                $params["m_net$i"] = $estRap ? null : (isset($l['m_net']) ? (string) $l['m_net'] : null);
                $params["d_visa$i"] = $estRap ? $this->dateSql($l['d_visa_obj'] ?? null) : null;
                $params["objet$i"] = $estRap ? $this->tronquer((string) ($l['objet'] ?? ''), 500) : null;
                $params["c_blocag$i"] = $estRap ? $this->tronquer((string) ($l['c_blocag'] ?? ''), 32) : null;
                $params["orig$i"] = $this->tronquer((string) ($l['orig'] ?? ''), 16);
                $params["num_bv$i"] = $estRap ? null : $this->tronquer((string) ($l['num_bv'] ?? ''), 64);
                ++$i;
            }
            $conn->executeStatement(
                'INSERT INTO sof_dc_mandat ('.$cols.') VALUES '.implode(',', $placeholders),
                $params,
            );
            $inseres += \count($chunk);
        }

        return $inseres;
    }

    private function dateSql(mixed $v): ?string
    {
        return $v instanceof \DateTimeInterface ? $v->format('Y-m-d') : null;
    }

    private function tronquer(string $v, int $max): ?string
    {
        $v = trim($v);
        if ($v === '') {
            return null;
        }

        return mb_strlen($v) > $max ? mb_substr($v, 0, $max) : $v;
    }

    /**
     * @return array<string, mixed>
     */
    private function serialiserLigne(DcMandat $d): array
    {
        return [
            'id' => $d->getId(),
            'type' => $d->getType()->value,
            'dat_regl' => $d->getDatRegl()?->format('Y-m-d'),
            'n_emis' => $d->getNEmis(),
            'n_regl' => $d->getNRegl(),
            'd_emis' => $d->getDEmis()?->format('Y-m-d'),
            'compte' => $d->getCompte(),
            'nat' => $d->getNat(),
            'pc' => $d->getPc(),
            'mdr' => $d->getMdr(),
            'matric' => $d->getMatric(),
            'nom' => $d->getNom(),
            'm_regl' => $d->getMontant(),
            'm_net' => $d->getMNet(),
            'num_bv' => $d->getNumBv(),
            // F5 RAP (mandat / rap / d_visa / objet / c_blocag)
            'mandat' => $d->getNEmis(),
            'rap' => $d->getType() === TypeDcMandat::RAP ? $d->getMontant() : null,
            'd_visa' => $d->getDVisa()?->format('Y-m-d'),
            'objet' => $d->getObjet(),
            'c_blocag' => $d->getCBlocag(),
        ];
    }

    private function formatPour(TypeDcMandat $type): FormatImport
    {
        return $type === TypeDcMandat::RAP ? FormatImport::F5 : FormatImport::F4;
    }

    private function sourcePour(TypeDcMandat $type): string
    {
        return $type === TypeDcMandat::RAP ? self::SOURCE_RAP : self::SOURCE;
    }

    /**
     * @return list<string>
     */
    private function colonnesApercu(TypeDcMandat $type): array
    {
        return $type === TypeDcMandat::RAP ? self::COLS_APERCU_RAP : self::COLS_APERCU;
    }

    /**
     * @return list<string>
     */
    private function colonnesAttendues(TypeDcMandat $type): array
    {
        return $type === TypeDcMandat::RAP ? self::COLS_APERCU_RAP : self::COLS_F4;
    }

    /**
     * @param array<string, mixed> $ligne
     *
     * @return array<string, mixed>
     */
    private function normaliserOracleRap(array $ligne): array
    {
        return [
            'n_emis' => $this->texte($this->cellule($ligne, 'N_EMIS', 'MANDAT')),
            'd_emis_obj' => $this->parserDate($this->cellule($ligne, 'D_EMIS')),
            'd_visa_obj' => $this->parserDate($this->cellule($ligne, 'D_VISA')),
            'compte' => $this->normaliserCompte((string) ($this->texte($this->cellule($ligne, 'C_IT', 'COMPTE')) ?? '')),
            'nat' => $this->normaliserNature((string) ($this->texte($this->cellule($ligne, 'C_NAT', 'NAT')) ?? '')),
            'pc' => $this->texte($this->cellule($ligne, 'C_PC', 'PC')),
            'mdr' => $this->texte($this->cellule($ligne, 'C_MDR', 'MDR')),
            'matric' => $this->texte($this->cellule($ligne, 'N_MATTIR', 'MATRIC')),
            'nom' => $this->texte($this->cellule($ligne, 'NOM')),
            'montant' => $this->montant($this->cellule($ligne, 'RAP')),
            'objet' => $this->texte($this->cellule($ligne, 'OBJET')),
            'c_blocag' => $this->texte($this->cellule($ligne, 'C_BLOCAG')),
            'orig' => $this->texte($this->cellule($ligne, 'ORIG')),
        ];
    }

    /**
     * @param array<string, mixed> $assoc
     *
     * @return array<string, mixed>
     */
    private function normaliserExcelRap(array $assoc): array
    {
        return [
            'n_emis' => $this->texte($assoc['N_EMIS'] ?? null),
            'd_emis_obj' => $this->parserDate($assoc['D_EMIS'] ?? null),
            'd_visa_obj' => $this->parserDate($assoc['D_VISA'] ?? null),
            'compte' => $this->normaliserCompte((string) ($this->texte($assoc['COMPTE'] ?? null) ?? '')),
            'nat' => $this->normaliserNature((string) ($this->texte($assoc['NAT'] ?? null) ?? '')),
            'pc' => $this->texte($assoc['PC'] ?? null),
            'mdr' => $this->texte($assoc['MDR'] ?? null),
            'matric' => $this->texte($assoc['MATRIC'] ?? null),
            'nom' => $this->texte($assoc['NOM'] ?? null),
            'montant' => $this->montant($assoc['RAP'] ?? null),
            'objet' => $this->texte($assoc['OBJET'] ?? null),
            'c_blocag' => $this->texte($assoc['C_BLOCAG'] ?? null),
            'orig' => null,
        ];
    }

    /**
     * @param array<string, mixed> $ligne
     *
     * @return array<string, mixed>
     */
    private function normaliserOracle(array $ligne): array
    {
        $dat = $this->parserDate($this->cellule($ligne, 'D_REGL', 'DAT_REGL'));
        $demis = $this->parserDate($this->cellule($ligne, 'D_EMIS'));

        return [
            'n_emis' => $this->texte($this->cellule($ligne, 'N_EMIS')),
            'n_regl' => $this->texte($this->cellule($ligne, 'N_REGL')),
            'd_emis_obj' => $demis,
            'dat_regl_obj' => $dat,
            'compte' => $this->normaliserCompte((string) ($this->texte($this->cellule($ligne, 'C_IT', 'COMPTE')) ?? '')),
            'nat' => $this->normaliserNature((string) ($this->texte($this->cellule($ligne, 'C_NAT', 'NAT')) ?? '')),
            'pc' => $this->texte($this->cellule($ligne, 'C_PC', 'PC')),
            'mdr' => $this->texte($this->cellule($ligne, 'C_MDR', 'MDR')),
            'matric' => $this->texte($this->cellule($ligne, 'N_MATTIR', 'MATRIC')),
            'nom' => $this->texte($this->cellule($ligne, 'NOM')),
            'montant' => $this->montant($this->cellule($ligne, 'M_REGL')),
            'm_net' => $this->montant($this->cellule($ligne, 'M_NET')),
            'num_bv' => $this->texte($this->cellule($ligne, 'N_BV', 'NUM_BV')),
            'orig' => $this->texte($this->cellule($ligne, 'C_ORIG', 'ORIG')),
        ];
    }

    /**
     * @param array<string, mixed> $assoc
     *
     * @return array<string, mixed>
     */
    private function normaliserExcel(array $assoc): array
    {
        $dat = $this->parserDate($assoc['DAT_REGL'] ?? null);
        $demis = $this->parserDate($assoc['D_EMIS'] ?? null);

        return [
            'n_emis' => $this->texte($assoc['N_EMIS'] ?? null),
            'n_regl' => $this->texte($assoc['N_REGL'] ?? null),
            'd_emis_obj' => $demis,
            'dat_regl_obj' => $dat,
            'compte' => $this->normaliserCompte((string) ($this->texte($assoc['COMPTE'] ?? null) ?? '')),
            'nat' => $this->normaliserNature((string) ($this->texte($assoc['NAT'] ?? null) ?? '')),
            'pc' => $this->texte($assoc['PC'] ?? null),
            'mdr' => $this->texte($assoc['MDR'] ?? null),
            'matric' => $this->texte($assoc['MATRIC'] ?? null),
            'nom' => $this->texte($assoc['NOM'] ?? null),
            'montant' => $this->montant($assoc['M_REGL'] ?? null),
            'm_net' => $this->montant($assoc['M_NET'] ?? null),
            'num_bv' => $this->texte($assoc['NUM_BV'] ?? null),
            'orig' => null,
        ];
    }

    /**
     * @param list<string> $cells
     *
     * @return array<string, int> colName => index
     */
    private function mapperEnTetes(array $cells): array
    {
        $aliases = [
            'DAT_REGL' => ['DAT_REGL', 'D_REGL', 'DATE_REGL', 'DATE REGL'],
            'N_EMIS' => ['N_EMIS', 'NEMIS', 'MANDAT', 'N_EMISSION'],
            'N_REGL' => ['N_REGL', 'NREGL', 'N_REGLEMENT'],
            'D_EMIS' => ['D_EMIS', 'DATE_EMIS', 'DATE EMIS'],
            'COMPTE' => ['COMPTE', 'C_IT', 'N_COMPTE'],
            'NAT' => ['NAT', 'NATURE', 'C_NAT'],
            'PC' => ['PC', 'C_PC'],
            'MDR' => ['MDR', 'C_MDR'],
            'MATRIC' => ['MATRIC', 'N_MATTIR', 'MATRICULE'],
            'NOM' => ['NOM', 'BENEFICIAIRE', 'L_NP'],
            'M_REGL' => ['M_REGL', 'MONTANT', 'M_REGLEMENT'],
            'M_NET' => ['M_NET', 'MONTANT_NET'],
            'NUM_BV' => ['NUM_BV', 'N_BV', 'BV'],
            'RAP' => ['RAP', 'M_REST', 'RESTE_A_PAYER'],
            'D_VISA' => ['D_VISA', 'DATE_VISA'],
            'OBJET' => ['OBJET', 'LIBELLE'],
            'C_BLOCAG' => ['C_BLOCAG', 'BLOCAG', 'C_BLOCAGE'],
        ];

        $map = [];
        foreach ($cells as $i => $raw) {
            $norm = $this->normaliserEnTete($raw);
            if ($norm === '') {
                continue;
            }
            foreach ($aliases as $canon => $cands) {
                if (isset($map[$canon])) {
                    continue;
                }
                foreach ($cands as $c) {
                    if ($norm === $this->normaliserEnTete($c)) {
                        $map[$canon] = $i;
                        break 2;
                    }
                }
            }
        }

        return $map;
    }

    private function normaliserEnTete(string $s): string
    {
        $s = strtoupper(trim($s));
        $s = strtr($s, ['É' => 'E', 'È' => 'E', 'Ê' => 'E', 'À' => 'A', 'Ù' => 'U', 'Ô' => 'O', 'Î' => 'I', 'Ç' => 'C']);
        $s = preg_replace('/[^A-Z0-9]+/', '_', $s) ?? $s;

        return trim($s, '_');
    }

    /**
     * @param list<mixed> $row
     */
    private function ligneVide(array $row): bool
    {
        foreach ($row as $c) {
            if (trim((string) ($c ?? '')) !== '') {
                return false;
            }
        }

        return true;
    }

    private function normaliserCompte(string $v): string
    {
        $v = trim($v);
        if ($v === '') {
            return '';
        }
        // 478131 → 4781-31
        if (preg_match('/^4781[\s_-]?31$/', $v)) {
            return self::COMPTE;
        }

        return $v;
    }

    private function normaliserNature(string $v): string
    {
        $v = trim($v);
        if ($v === '') {
            return '';
        }
        if (preg_match('/^0*81$/', $v)) {
            return self::NATURE;
        }

        return $v;
    }

    /**
     * @return list<LotImport>
     */
    private function listerLotsActifs(int $periodeId, TypeDcMandat $type = TypeDcMandat::REGLE): array
    {
        /** @var list<LotImport> $candidats */
        $candidats = $this->lotImportRepository->createQueryBuilder('l')
            ->andWhere('IDENTITY(l.periode) = :pid')
            ->andWhere('l.format = :format')
            ->andWhere('l.statut = :actif')
            ->setParameter('pid', $periodeId)
            ->setParameter('format', $this->formatPour($type))
            ->setParameter('actif', StatutLotImport::ACTIF)
            ->orderBy('l.importeLe', 'DESC')
            ->getQuery()
            ->getResult();

        $out = [];
        foreach ($candidats as $lot) {
            $p = $lot->getParametres();
            $source = $p['source'] ?? null;
            // Accepter les lots F4/F5 TVA même si source absente (rétrocompat)
            if ($source === null || $source === $this->sourcePour($type)) {
                $out[] = $lot;
            }
        }

        // Si filtre source trop strict : tout lot F4 ACTIF de la période
        if ($out === [] && $candidats !== []) {
            return $candidats;
        }

        return $out;
    }

    private function trouverLotActif(int $periodeId, TypeDcMandat $type = TypeDcMandat::REGLE): ?LotImport
    {
        return $this->listerLotsActifs($periodeId, $type)[0] ?? null;
    }

    private function resoudrePeriode(?int $periodeId, ?\DateTimeImmutable $dateRef = null): ?Periode
    {
        if ($periodeId !== null) {
            $p = $this->periodeRepository->find($periodeId);

            return $p instanceof Periode ? $p : null;
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

    private function parserDate(mixed $v): ?\DateTimeImmutable
    {
        if ($v instanceof \DateTimeImmutable) {
            return $v->setTime(0, 0);
        }
        if ($v instanceof \DateTimeInterface) {
            return \DateTimeImmutable::createFromInterface($v)->setTime(0, 0);
        }
        if (\is_numeric($v) && (float) $v > 20000) {
            // Série Excel
            try {
                $dt = \PhpOffice\PhpSpreadsheet\Shared\Date::excelToDateTimeObject((float) $v);

                return \DateTimeImmutable::createFromMutable($dt)->setTime(0, 0);
            } catch (\Throwable) {
                return null;
            }
        }
        $brut = trim((string) ($v ?? ''));
        if ($brut === '') {
            return null;
        }
        foreach (['Y-m-d', 'd/m/Y', 'd-m-Y'] as $fmt) {
            $d = \DateTimeImmutable::createFromFormat('!'.$fmt, $brut);
            if ($d instanceof \DateTimeImmutable) {
                $err = \DateTimeImmutable::getLastErrors();
                if (($err['warning_count'] ?? 0) === 0 && ($err['error_count'] ?? 0) === 0) {
                    return $d;
                }
            }
        }

        return null;
    }

    /**
     * @return array<string, mixed>
     */
    private function serialiserPeriode(Periode $p): array
    {
        $mois = $p->getMois();

        return [
            'id' => $p->getId(),
            'mois' => $mois,
            'exercice_annee' => $p->getExercice()->getAnnee(),
            'mois_libelle' => Mois::tryFrom($mois)?->libelle(),
        ];
    }

    private function acteur(): ?Utilisateur
    {
        $u = $this->security->getUser();

        return $u instanceof Utilisateur ? $u : null;
    }

    private function cellule(array $ligne, string ...$cles): mixed
    {
        foreach ($cles as $cle) {
            foreach ($ligne as $k => $v) {
                if (strcasecmp((string) $k, $cle) === 0) {
                    return $v;
                }
            }
        }

        return null;
    }

    private function texte(mixed $v): ?string
    {
        if ($v === null) {
            return null;
        }
        $s = trim((string) $v);
        if ($s === '') {
            return null;
        }
        // Excel peut renvoyer 81.0
        if (is_numeric($s) && str_contains($s, '.')) {
            $f = (float) $s;
            if (abs($f - round($f)) < 1e-9) {
                $s = (string) (int) round($f);
            }
        }

        return $s;
    }

    private function montant(mixed $v): string
    {
        if ($v === null || $v === '') {
            return '0.00';
        }
        if (\is_int($v) || \is_float($v)) {
            return number_format((float) $v, 2, '.', '');
        }
        $s = preg_replace('/[\s\x{00A0}\x{202F}\']+/u', '', (string) $v) ?? '';
        $s = str_replace(',', '.', $s);
        if ($s === '' || !is_numeric($s)) {
            return '0.00';
        }

        return number_format((float) $s, 2, '.', '');
    }
}
