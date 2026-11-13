<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Service;

use App\Module\ServiceOperationsFinancieres\Entite\Import\AnomalieImport;
use App\Module\ServiceOperationsFinancieres\Entite\Import\IgOperation;
use App\Module\ServiceOperationsFinancieres\Entite\Import\LotImport;
use App\Module\ServiceOperationsFinancieres\Entite\Periode;
use App\Module\ServiceOperationsFinancieres\Enum\FormatImport;
use App\Module\ServiceOperationsFinancieres\Enum\Mois;
use App\Module\ServiceOperationsFinancieres\Enum\StatutLotImport;
use App\Module\ServiceOperationsFinancieres\Repository\IgOperationRepository;
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
 * Imports › Extractions IG › Crédits délégués (F1 · VIDR → ig_operation).
 * Source ig-cdel, compte balance 4742-%.
 */
class IgCreditsDeleguesService
{
    public const SOURCE = 'ig-cdel';
    private const SOURCE_LIBELLE = 'Crédits délégués (4742)';
    private const ETAPE = 'ig_operation';
    private const COMPTE_PREFIX = '4742-';
    private const BATCH_INSERT = 250;

    /** Colonnes VIDR (aperçu maquette). */
    public const COLS_VIDR = IgReglementsTvaService::COLS_VIDR;

    public function __construct(
        private readonly ScriptPoolSof $scriptPoolSof,
        private readonly PeriodeRepository $periodeRepository,
        private readonly LotImportRepository $lotImportRepository,
        private readonly IgOperationRepository $igOperationRepository,
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

        $periode = $this->resoudrePeriode($periodeId);
        if (!$periode instanceof Periode || $periode->getId() === null) {
            $out = $this->vide(null, $pageSize);
            $out['message'] = 'Aucune période SROT.';

            return $out;
        }

        $lot = $this->trouverLotActif($periode->getId());
        if (!$lot instanceof LotImport || $lot->getId() === null) {
            return $this->vide($this->serialiserPeriode($periode), $pageSize);
        }

        $nombre = $this->igOperationRepository->compterParLot($lot->getId());
        $pages = $nombre > 0 ? (int) ceil($nombre / $pageSize) : 0;
        if ($pages > 0 && $page > $pages) {
            $page = $pages;
        }

        $lignes = [];
        if ($nombre > 0) {
            /** @var list<IgOperation> $entites */
            $entites = $this->igOperationRepository->createQueryBuilder('o')
                ->andWhere('o.lot = :lot')
                ->setParameter('lot', $lot->getId())
                ->orderBy('o.dCpta', 'ASC')
                ->addOrderBy('o.nRegl', 'ASC')
                ->addOrderBy('o.id', 'ASC')
                ->setFirstResult(($page - 1) * $pageSize)
                ->setMaxResults($pageSize)
                ->getQuery()
                ->getResult();
            $lignes = array_map(fn (IgOperation $e): array => $this->serialiserLigne($e), $entites);
        }

        $params = $lot->getParametres();

        return [
            'periode' => $this->serialiserPeriode($periode),
            'source' => self::SOURCE,
            'format' => FormatImport::F1->value,
            'compte' => self::COMPTE_PREFIX,
            'nature' => '',
            'colonnes' => self::COLS_VIDR,
            'lot' => $this->lotImportService->obtenir($lot->getId()),
            'lignes' => $lignes,
            'anomalies' => $this->lotImportService->listerAnomalies($lot->getId()),
            'nombre' => $nombre,
            'total' => $lot->getMontantTotal(),
            'premiere_date' => $params['premiere_date'] ?? null,
            'derniere_date' => $params['derniere_date'] ?? null,
            'page' => $page,
            'page_size' => $pageSize,
            'pages' => $pages,
            'message' => null,
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
            throw new DonneesInvalidesException(
                sprintf(
                    'Aucune période SROT pour %s %d.',
                    Mois::tryFrom((int) $fin->format('n'))?->libelle() ?? $fin->format('m'),
                    (int) $fin->format('Y'),
                ),
            );
        }

        try {
            $brutes = $this->scriptPoolSof->extraireDepensesCreditsDelegues(
                $debut->format('d/m/Y'),
                $fin->format('d/m/Y'),
            );
        } catch (\Throwable $e) {
            throw new DonneesInvalidesException(
                'Extraction IG crédits délégués impossible : '.$e->getMessage(),
            );
        }

        $normalisees = [];
        foreach ($brutes as $ligne) {
            $normalisees[] = $this->normaliserLigne($ligne);
        }

        return $this->persisterLot(
            $periode,
            $normalisees,
            $debut,
            $fin,
            'oracle',
            sprintf('vidr_ig_cdel_%s_%s', $debut->format('Ymd'), $fin->format('Ymd')),
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
            $fin = (new \DateTimeImmutable(sprintf('%04d-%02d-01', $annee, $mois)))->modify('last day of this month');
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

        $rows = $spreadsheet->getActiveSheet()->toArray(null, true, true, false);
        if ($rows === []) {
            throw new DonneesInvalidesException('Fichier Excel vide.');
        }

        $headerRow = null;
        $headerIndex = 0;
        foreach ($rows as $i => $row) {
            $map = $this->mapperEnTetes(array_map(static fn ($c) => (string) ($c ?? ''), $row));
            if (isset($map['M_REGL']) && (isset($map['C_IT']) || isset($map['N_REGL']))) {
                $headerRow = $map;
                $headerIndex = (int) $i;
                break;
            }
        }
        if ($headerRow === null) {
            throw new DonneesInvalidesException(
                'En-têtes VIDR introuvables (attendu C_IT, N_REGL, M_REGL…).',
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
            $normalisees[] = $this->normaliserLigne($assoc);
        }

        return $this->persisterLot(
            $periode,
            $normalisees,
            $debut,
            $fin,
            'excel',
            $fichier->getClientOriginalName() ?: 'vidr_ig_cdel.xlsx',
            hash_file('sha256', $fichier->getPathname()) ?: null,
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
        $total = '0.00';
        $premiere = null;
        $derniere = null;

        foreach ($lignes as $i => $l) {
            $numLigne = $i + 2;
            $compte = $this->normaliserCompte((string) ($l['c_it'] ?? ''));

            if (!str_starts_with($compte, self::COMPTE_PREFIX)) {
                $anomalies[] = [
                    'ligne' => $numLigne,
                    'colonne' => 'C_IT',
                    'motif' => 'Compte différent de 4742- (« '.$compte.' ») — ligne rejetée',
                ];
                continue;
            }
            $l['c_it'] = $compte;

            $total = bcadd($total, (string) ($l['m_regl'] ?? '0.00'), 2);
            $dat = $l['d_cpta_obj'] ?? null;
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

            $lot = new LotImport($periode, FormatImport::F1, [
                'source' => self::SOURCE,
                'source_libelle' => self::SOURCE_LIBELLE,
                'etape' => self::ETAPE,
                'compte' => self::COMPTE_PREFIX,
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

            $nbPersistees = $this->insererOperationsSql($id, $acceptees);

            foreach ($anomalies as $a) {
                $this->em->persist(new AnomalieImport(
                    $lot,
                    (int) $a['ligne'],
                    (string) $a['motif'],
                    $a['colonne'] !== '' ? (string) $a['colonne'] : null,
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
            'ig_operation',
            'ig-cdel/'.$pid,
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

        return $etat;
    }

    /**
     * @param list<array<string, mixed>> $lignes
     */
    private function insererOperationsSql(int $lotId, array $lignes): int
    {
        if ($lignes === []) {
            return 0;
        }

        $conn = $this->em->getConnection();
        $cols = 'lot_id, c_pca, d_cpta, n_regl, n_lig_r, c_typ_op, n_op, c_guic, n_mattir, l_np, c_ope, c_it, c_nat, c_ref1, c_ref2, m_regl, c_nop, c_mdr, n_cheq, c_cais, l_tiers';
        $inseres = 0;

        foreach (array_chunk($lignes, self::BATCH_INSERT) as $chunk) {
            $placeholders = [];
            $params = [];
            $i = 0;
            foreach ($chunk as $l) {
                $placeholders[] = sprintf(
                    '(:lot%d,:c_pca%d,:d_cpta%d,:n_regl%d,:n_lig_r%d,:c_typ_op%d,:n_op%d,:c_guic%d,:n_mattir%d,:l_np%d,:c_ope%d,:c_it%d,:c_nat%d,:c_ref1%d,:c_ref2%d,:m_regl%d,:c_nop%d,:c_mdr%d,:n_cheq%d,:c_cais%d,:l_tiers%d)',
                    $i, $i, $i, $i, $i, $i, $i, $i, $i, $i, $i, $i, $i, $i, $i, $i, $i, $i, $i, $i, $i,
                );
                $params["lot$i"] = $lotId;
                $params["c_pca$i"] = $this->tronquer((string) ($l['c_pca'] ?? ''), 16);
                $params["d_cpta$i"] = $this->dateSql($l['d_cpta_obj'] ?? null);
                $params["n_regl$i"] = $this->tronquer((string) ($l['n_regl'] ?? ''), 32);
                $params["n_lig_r$i"] = isset($l['n_lig_r']) && $l['n_lig_r'] !== '' && $l['n_lig_r'] !== null
                    ? (int) $l['n_lig_r'] : null;
                $params["c_typ_op$i"] = $this->tronquer((string) ($l['c_typ_op'] ?? ''), 16);
                $params["n_op$i"] = $this->tronquer((string) ($l['n_op'] ?? ''), 32);
                $params["c_guic$i"] = $this->tronquer((string) ($l['c_guic'] ?? ''), 32);
                $params["n_mattir$i"] = $this->tronquer((string) ($l['n_mattir'] ?? ''), 64);
                $params["l_np$i"] = $this->tronquer((string) ($l['l_np'] ?? ''), 255);
                $params["c_ope$i"] = $this->tronquer((string) ($l['c_ope'] ?? ''), 32);
                $params["c_it$i"] = $this->tronquer((string) ($l['c_it'] ?? ''), 32);
                $params["c_nat$i"] = $this->tronquer((string) ($l['c_nat'] ?? ''), 32);
                $params["c_ref1$i"] = $this->tronquer((string) ($l['c_ref1'] ?? ''), 64);
                $params["c_ref2$i"] = $this->tronquer((string) ($l['c_ref2'] ?? ''), 64);
                $params["m_regl$i"] = (string) ($l['m_regl'] ?? '0.00');
                $params["c_nop$i"] = $this->tronquer((string) ($l['c_nop'] ?? ''), 8);
                $params["c_mdr$i"] = $this->tronquer((string) ($l['c_mdr'] ?? ''), 16);
                $params["n_cheq$i"] = $this->tronquer((string) ($l['n_cheq'] ?? ''), 64);
                $params["c_cais$i"] = $this->tronquer((string) ($l['c_cais'] ?? ''), 32);
                $params["l_tiers$i"] = $this->tronquer((string) ($l['l_tiers'] ?? ''), 255);
                ++$i;
            }

            $conn->executeStatement(
                'INSERT INTO sof_ig_operation ('.$cols.') VALUES '.implode(',', $placeholders),
                $params,
            );
            $inseres += \count($chunk);
        }

        return $inseres;
    }

    /**
     * @return array<string, mixed>
     */
    private function vide(?array $periode, int $pageSize): array
    {
        return [
            'periode' => $periode,
            'source' => self::SOURCE,
            'format' => FormatImport::F1->value,
            'compte' => self::COMPTE_PREFIX,
            'nature' => '',
            'colonnes' => self::COLS_VIDR,
            'lot' => null,
            'lignes' => [],
            'anomalies' => [],
            'nombre' => 0,
            'total' => '0.00',
            'premiere_date' => null,
            'derniere_date' => null,
            'page' => 1,
            'page_size' => $pageSize,
            'pages' => 0,
            'message' => null,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function serialiserLigne(IgOperation $e): array
    {
        return [
            'id' => $e->getId(),
            'c_pca' => $e->getCPca(),
            'd_cpta' => $e->getDCpta()?->format('Y-m-d'),
            'n_regl' => $e->getNRegl(),
            'n_lig_r' => $e->getNLigR(),
            'c_typ_op' => $e->getCTypOp(),
            'n_op' => $e->getNOp(),
            'c_guic' => $e->getCGuic(),
            'n_mattir' => $e->getNMattir(),
            'l_np' => $e->getLNp(),
            'c_ope' => $e->getCOpe(),
            'c_it' => $e->getCIt(),
            'c_nat' => $e->getCNat(),
            'c_ref1' => $e->getCRef1(),
            'c_ref2' => $e->getCRef2(),
            'm_regl' => $e->getMRegl(),
            'c_nop' => $e->getCNop(),
            'c_mdr' => $e->getCMdr(),
            'n_cheq' => $e->getNCheq(),
            'c_cais' => $e->getCCais(),
            'l_tiers' => $e->getLTiers(),
        ];
    }

    /**
     * @param array<string, mixed> $ligne
     *
     * @return array<string, mixed>
     */
    private function normaliserLigne(array $ligne): array
    {
        $date = $this->parserDate($this->cellule($ligne, 'D_CPTA'));

        return [
            'c_pca' => $this->texte($this->cellule($ligne, 'C_PCA')),
            'd_cpta_obj' => $date,
            'n_regl' => $this->texte($this->cellule($ligne, 'N_REGL')),
            'n_lig_r' => $this->entier($this->cellule($ligne, 'N_LIG_R')),
            'c_typ_op' => $this->texte($this->cellule($ligne, 'C_TYP_OP')),
            'n_op' => $this->texte($this->cellule($ligne, 'N_OP')),
            'c_guic' => $this->texte($this->cellule($ligne, 'C_GUIC')),
            'n_mattir' => $this->texte($this->cellule($ligne, 'N_MATTIR')),
            'l_np' => $this->texte($this->cellule($ligne, 'L_NP')),
            'c_ope' => $this->texte($this->cellule($ligne, 'C_OPE')),
            'c_it' => $this->texte($this->cellule($ligne, 'C_IT')),
            'c_nat' => $this->texte($this->cellule($ligne, 'C_NAT')),
            'c_ref1' => $this->texte($this->cellule($ligne, 'C_REF1')),
            'c_ref2' => $this->texte($this->cellule($ligne, 'C_REF2')),
            'm_regl' => $this->montant($this->cellule($ligne, 'M_REGL')),
            'c_nop' => $this->texte($this->cellule($ligne, 'C_NOP')),
            'c_mdr' => $this->texte($this->cellule($ligne, 'C_MDR')),
            'n_cheq' => $this->texte($this->cellule($ligne, 'N_CHEQ')),
            'c_cais' => $this->texte($this->cellule($ligne, 'C_CAIS')),
            'l_tiers' => $this->texte($this->cellule($ligne, 'L_TIERS')),
        ];
    }

    /**
     * @param list<string> $cells
     *
     * @return array<string, int>
     */
    private function mapperEnTetes(array $cells): array
    {
        $map = [];
        foreach ($cells as $i => $raw) {
            $norm = strtoupper(trim($raw));
            $norm = strtr($norm, ['É' => 'E', 'È' => 'E', 'Ê' => 'E', 'À' => 'A', 'Ù' => 'U', 'Ô' => 'O', 'Î' => 'I', 'Ç' => 'C']);
            $norm = trim(preg_replace('/[^A-Z0-9]+/', '_', $norm) ?? $norm, '_');
            if ($norm === '' || !\in_array($norm, self::COLS_VIDR, true) || isset($map[$norm])) {
                continue;
            }
            $map[$norm] = $i;
        }

        return $map;
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
        $v = trim((string) preg_replace('/\s+/', '', $v));

        return str_replace('_', '-', $v);
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
            ->setParameter('format', FormatImport::F1)
            ->setParameter('actif', StatutLotImport::ACTIF)
            ->orderBy('l.importeLe', 'DESC')
            ->getQuery()
            ->getResult();

        return array_values(array_filter(
            $candidats,
            static fn (LotImport $l): bool => ($l->getParametres()['source'] ?? null) === self::SOURCE,
        ));
    }

    private function trouverLotActif(int $periodeId): ?LotImport
    {
        return $this->listerLotsActifs($periodeId)[0] ?? null;
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
        if ($v instanceof \DateTimeInterface) {
            return \DateTimeImmutable::createFromInterface($v)->setTime(0, 0);
        }
        if (\is_numeric($v) && (float) $v > 20000) {
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

    /** @param array<string, mixed> $ligne */
    private function cellule(array $ligne, string $cle): mixed
    {
        foreach ($ligne as $nom => $valeur) {
            if (strcasecmp((string) $nom, $cle) === 0) {
                return $valeur;
            }
        }

        return null;
    }

    private function texte(mixed $v): ?string
    {
        if ($v === null) {
            return null;
        }

        $t = trim((string) $v);
        if ($t === '') {
            return null;
        }
        if (is_numeric($t) && str_contains($t, '.')) {
            $f = (float) $t;
            if (abs($f - round($f)) < 1e-9) {
                $t = (string) (int) round($f);
            }
        }

        return $t;
    }

    private function entier(mixed $v): ?int
    {
        return ($v !== null && $v !== '' && is_numeric($v)) ? (int) $v : null;
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

        return is_numeric($s) ? number_format((float) $s, 2, '.', '') : '0.00';
    }
}
