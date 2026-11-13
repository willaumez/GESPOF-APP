<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Service;

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
use Symfony\Bundle\SecurityBundle\Security;

/**
 * Import F1 — opérations IG VIDR comptes pétrole (ig_operation).
 * Une feuille (lot) par couple compte / nature.
 */
class IgOperationPetroleService
{
    private const SOURCE = 'ig-petrole';
    private const ETAPE = 'ig_operation';

    /**
     * Feuilles F1 (manuel SROT p. 27 + 1812-201).
     *
     * @var list<array{compte: string, nature: ?string, libelle: string}>
     */
    public const FEUILLES = [
        ['compte' => '1812-201', 'nature' => null, 'libelle' => 'Transferts pétroliers'],
        ['compte' => '1812-219', 'nature' => '1', 'libelle' => 'IS Transferts'],
        ['compte' => '4781-11', 'nature' => '4', 'libelle' => 'IS Régularisé'],
        ['compte' => '4781-12', 'nature' => '4', 'libelle' => 'IS Contentieux'],
        ['compte' => '4783-1', 'nature' => '23', 'libelle' => 'Dividendes'],
        ['compte' => '4783-2', 'nature' => '23', 'libelle' => 'Dividendes Contentieux'],
        ['compte' => '4783-1', 'nature' => '1', 'libelle' => 'RMP'],
        ['compte' => '4751-101', 'nature' => '4', 'libelle' => 'RMP Gaz'],
        ['compte' => '4783-2', 'nature' => '1', 'libelle' => 'RMP Contentieux'],
        ['compte' => '4783-1', 'nature' => '6', 'libelle' => 'Redevance Superficiaire'],
        ['compte' => '4783-2', 'nature' => '6', 'libelle' => 'Redevance Superficiaire Contentieux'],
        ['compte' => '4751-101', 'nature' => '2', 'libelle' => 'Profit Oil'],
        ['compte' => '4751-101', 'nature' => '3', 'libelle' => 'Discount et Boni'],
        ['compte' => '4751-101', 'nature' => '7', 'libelle' => 'Discount et Boni'],
        ['compte' => '4751-227', 'nature' => '27', 'libelle' => 'Autres recettes pétrolières'],
    ];

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
     * Synthèse des lots F1 actifs (une entrée par feuille).
     *
     * @return array<string, mixed>
     */
    public function listerFeuilles(?int $periodeId = null): array
    {
        $periode = $this->resoudrePeriode($periodeId);
        if (!$periode instanceof Periode || $periode->getId() === null) {
            return [
                'periode' => null,
                'feuilles' => [],
                'message' => 'Aucune période SROT.',
            ];
        }

        $feuilles = [];
        foreach (self::FEUILLES as $def) {
            $lot = $this->trouverLotActif($periode->getId(), $def['compte'], $def['nature']);
            $nb = $lot?->getId() !== null
                ? $this->igOperationRepository->compterParLot($lot->getId())
                : 0;
            $feuilles[] = [
                'compte' => $def['compte'],
                'nature' => $def['nature'],
                'libelle' => $def['libelle'],
                'cle' => $this->cleFeuille($def['compte'], $def['nature']),
                'lot' => $lot instanceof LotImport && $lot->getId() !== null
                    ? $this->lotImportService->obtenir($lot->getId())
                    : null,
                'nb_lignes' => $nb,
                'montant_total' => $lot?->getMontantTotal() ?? '0.00',
            ];
        }

        return [
            'periode' => $this->serialiserPeriode($periode),
            'feuilles' => $feuilles,
            'message' => null,
        ];
    }

    /**
     * Détail d'une feuille (lot ACTIF + lignes).
     *
     * @return array<string, mixed>
     */
    public function obtenirFeuille(string $compte, ?string $nature, ?int $periodeId = null): array
    {
        $def = $this->trouverDefinition($compte, $nature);
        $periode = $this->resoudrePeriode($periodeId);
        if (!$periode instanceof Periode || $periode->getId() === null) {
            throw new DonneesInvalidesException('Aucune période SROT.');
        }

        $lot = $this->trouverLotActif($periode->getId(), $def['compte'], $def['nature']);
        if (!$lot instanceof LotImport || $lot->getId() === null) {
            return [
                'periode' => $this->serialiserPeriode($periode),
                'feuille' => [
                    'compte' => $def['compte'],
                    'nature' => $def['nature'],
                    'libelle' => $def['libelle'],
                    'cle' => $this->cleFeuille($def['compte'], $def['nature']),
                ],
                'lot' => null,
                'lignes' => [],
                'nombre' => 0,
                'total' => '0.00',
                'message' => 'Aucun lot F1 actif pour cette feuille. Lancez une extraction.',
            ];
        }

        return $this->serialiserFeuille($lot, $periode, $def);
    }

    /**
     * Extraction Oracle → un lot F1 ACTIF par feuille (compte / nature).
     *
     * @return array<string, mixed>
     */
    public function importer(string $dateDebut, string $dateFin, ?int $periodeId = null): array
    {
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

        $comptes = array_values(array_unique(array_map(
            static fn (array $f): string => $f['compte'],
            self::FEUILLES,
        )));

        $dateDeb = $debut->format('d/m/Y');
        $dateFinFmt = $fin->format('d/m/Y');

        try {
            $brutes = $this->scriptPoolSof->extraireRecettesPetrolieresVidr($dateDeb, $dateFinFmt, $comptes);
        } catch (\Throwable $e) {
            throw new DonneesInvalidesException(
                'Extraction IG VIDR pétrole impossible : '.$e->getMessage(),
            );
        }

        /** @var array<string, list<array<string, mixed>>> $parFeuille */
        $parFeuille = [];
        foreach (self::FEUILLES as $def) {
            $parFeuille[$this->cleFeuille($def['compte'], $def['nature'])] = [];
        }

        foreach ($brutes as $ligne) {
            $normalisee = $this->normaliserLigne($ligne);
            $compte = $normalisee['c_it'] ?? '';
            $nature = $normalisee['c_nat'] ?? null;
            if ($compte === '1812-201' && $this->estNa($normalisee)) {
                continue;
            }
            foreach (self::FEUILLES as $def) {
                if ($def['compte'] !== $compte) {
                    continue;
                }
                if ($def['nature'] === null) {
                    if ($def['compte'] === '1812-201') {
                        $parFeuille[$this->cleFeuille($def['compte'], null)][] = $normalisee;
                    }
                    break;
                }
                if ($this->naturesEgales($nature, $def['nature'])) {
                    $parFeuille[$this->cleFeuille($def['compte'], $def['nature'])][] = $normalisee;
                    break;
                }
            }
        }

        $acteur = $this->acteur();
        $resultats = [];
        foreach (self::FEUILLES as $def) {
            $cle = $this->cleFeuille($def['compte'], $def['nature']);
            $lignes = $parFeuille[$cle] ?? [];
            $lot = $this->creerLotFeuille($periode, $def, $lignes, $debut, $fin, $acteur);
            $resultats[] = [
                'compte' => $def['compte'],
                'nature' => $def['nature'],
                'libelle' => $def['libelle'],
                'cle' => $cle,
                'lot_id' => $lot->getId(),
                'nb_lignes' => $lot->getNbLignes(),
                'montant_total' => $lot->getMontantTotal(),
            ];
        }

        $this->journalAuditService->enregistrer(
            'IMPORTER',
            'ig_operation',
            'petrole/'.$periode->getId(),
            $acteur,
            null,
            [
                'date_debut' => $debut->format('Y-m-d'),
                'date_fin' => $fin->format('Y-m-d'),
                'feuilles' => count($resultats),
                'nb_lignes' => array_sum(array_column($resultats, 'nb_lignes')),
            ],
        );

        return [
            'periode' => $this->serialiserPeriode($periode),
            'date_debut' => $debut->format('Y-m-d'),
            'date_fin' => $fin->format('Y-m-d'),
            'feuilles' => $resultats,
            'message' => null,
        ];
    }

    /**
     * @param array{compte: string, nature: ?string, libelle: string} $def
     * @param list<array<string, mixed>>                              $lignes
     */
    private function creerLotFeuille(
        Periode $periode,
        array $def,
        array $lignes,
        \DateTimeImmutable $debut,
        \DateTimeImmutable $fin,
        ?Utilisateur $acteur,
    ): LotImport {
        $params = [
            'source' => self::SOURCE,
            'source_libelle' => 'Comptes pétrole · '.$def['libelle'],
            'etape' => self::ETAPE,
            'compte' => $def['compte'],
            'nature' => $def['nature'],
            'date_debut' => $debut->format('Y-m-d'),
            'date_fin' => $fin->format('Y-m-d'),
        ];

        foreach ($this->listerLotsActifsFeuille($periode->getId(), $def['compte'], $def['nature']) as $ancien) {
            $ancien->setStatut(StatutLotImport::REMPLACE);
        }
        $this->em->flush();

        $total = '0.00';
        foreach ($lignes as $l) {
            $total = bcadd($total, (string) ($l['m_regl'] ?? '0.00'), 2);
        }

        $lot = new LotImport($periode, FormatImport::F1, $params);
        $lot->setNbLignes(count($lignes));
        $lot->setMontantTotal($total);
        $lot->setFichierNom(sprintf(
            'ig_op_%s_%s_%s_%s',
            str_replace('-', '', $def['compte']),
            $def['nature'] ?? 'all',
            $debut->format('Ymd'),
            $fin->format('Ymd'),
        ));
        if ($acteur instanceof Utilisateur) {
            $lot->setImportePar($acteur);
        }
        $this->em->persist($lot);
        $this->em->flush();

        foreach ($lignes as $l) {
            $this->em->persist($this->versEntite($lot, $l));
        }
        $this->em->flush();

        return $lot;
    }

    /**
     * @param array{compte: string, nature: ?string, libelle: string} $def
     *
     * @return array<string, mixed>
     */
    private function serialiserFeuille(LotImport $lot, Periode $periode, array $def): array
    {
        $lotId = $lot->getId() ?? 0;
        $entites = $this->igOperationRepository->listerParLot($lotId);
        $lignes = [];
        $total = '0.00';
        foreach ($entites as $e) {
            $row = $this->serialiserLigne($e);
            $lignes[] = $row;
            $total = bcadd($total, (string) ($row['m_regl'] ?? '0'), 2);
        }

        return [
            'periode' => $this->serialiserPeriode($periode),
            'feuille' => [
                'compte' => $def['compte'],
                'nature' => $def['nature'],
                'libelle' => $def['libelle'],
                'cle' => $this->cleFeuille($def['compte'], $def['nature']),
            ],
            'lot' => $this->lotImportService->obtenir($lotId),
            'lignes' => $lignes,
            'nombre' => count($lignes),
            'total' => $total,
            'message' => $lignes === [] ? 'Aucune opération pour cette feuille.' : null,
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
     * @param array<string, mixed> $l
     */
    private function versEntite(LotImport $lot, array $l): IgOperation
    {
        $e = new IgOperation($lot);
        $e->setCPca($l['c_pca'] ?? null);
        $e->setDCpta($l['d_cpta_obj'] ?? null);
        $e->setNRegl($l['n_regl'] ?? null);
        $e->setNLigR(isset($l['n_lig_r']) ? (int) $l['n_lig_r'] : null);
        $e->setCTypOp($l['c_typ_op'] ?? null);
        $e->setNOp($l['n_op'] ?? null);
        $e->setCGuic($l['c_guic'] ?? null);
        $e->setNMattir($l['n_mattir'] ?? null);
        $e->setLNp($l['l_np'] ?? null);
        $e->setCOpe($l['c_ope'] ?? null);
        $e->setCIt($l['c_it'] ?? null);
        $e->setCNat($l['c_nat'] ?? null);
        $e->setCRef1($l['c_ref1'] ?? null);
        $e->setCRef2($l['c_ref2'] ?? null);
        $e->setMRegl($l['m_regl'] ?? null);
        $e->setCNop($l['c_nop'] ?? null);
        $e->setCMdr($l['c_mdr'] ?? null);
        $e->setNCheq($l['n_cheq'] ?? null);
        $e->setCCais($l['c_cais'] ?? null);
        $e->setLTiers($l['l_tiers'] ?? null);

        return $e;
    }

    /**
     * @return array<string, mixed>
     */
    private function normaliserLigne(array $ligne): array
    {
        $date = $this->parserDateCellule($this->cellule($ligne, 'D_CPTA'));

        return [
            'c_pca' => $this->texte($this->cellule($ligne, 'C_PCA')),
            'd_cpta' => $date?->format('Y-m-d'),
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
     * @param array<string, mixed> $l
     */
    private function estNa(array $l): bool
    {
        foreach (['c_nat', 'c_ref1', 'c_ref2', 'l_np'] as $cle) {
            $v = strtoupper(trim((string) ($l[$cle] ?? '')));
            if ($v === 'N/A' || $v === 'NA') {
                return true;
            }
        }

        return false;
    }

    private function naturesEgales(?string $a, ?string $b): bool
    {
        return trim((string) $a) === trim((string) $b);
    }

    /**
     * @return array{compte: string, nature: ?string, libelle: string}
     */
    private function trouverDefinition(string $compte, ?string $nature): array
    {
        $compte = trim($compte);
        $nature = $nature !== null && trim($nature) !== '' ? trim($nature) : null;
        foreach (self::FEUILLES as $def) {
            if ($def['compte'] === $compte && $this->naturesEgales($def['nature'], $nature)) {
                return $def;
            }
        }

        throw new DonneesInvalidesException(
            sprintf('Feuille inconnue : compte %s / nature %s.', $compte, $nature ?? '—'),
        );
    }

    private function cleFeuille(string $compte, ?string $nature): string
    {
        return $compte.'/'.($nature ?? '-');
    }

    private function trouverLotActif(int $periodeId, string $compte, ?string $nature): ?LotImport
    {
        return $this->listerLotsActifsFeuille($periodeId, $compte, $nature)[0] ?? null;
    }

    /**
     * @return list<LotImport>
     */
    private function listerLotsActifsFeuille(int $periodeId, string $compte, ?string $nature): array
    {
        /** @var list<LotImport> $candidats */
        $candidats = $this->lotImportRepository->createQueryBuilder('l')
            ->andWhere('l.periode = :periodeId')
            ->andWhere('l.format = :format')
            ->andWhere('l.statut = :actif')
            ->setParameter('periodeId', $periodeId)
            ->setParameter('format', FormatImport::F1)
            ->setParameter('actif', StatutLotImport::ACTIF)
            ->orderBy('l.importeLe', 'DESC')
            ->getQuery()
            ->getResult();

        $out = [];
        foreach ($candidats as $lot) {
            $p = $lot->getParametres();
            if (($p['source'] ?? null) !== self::SOURCE || ($p['etape'] ?? null) !== self::ETAPE) {
                continue;
            }
            if (($p['compte'] ?? null) !== $compte) {
                continue;
            }
            $natLot = $p['nature'] ?? null;
            $natLot = $natLot !== null && $natLot !== '' ? (string) $natLot : null;
            if ($this->naturesEgales($natLot, $nature)) {
                $out[] = $lot;
            }
        }

        return $out;
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
            ->leftJoin('p.exercice', 'e')->addSelect('e')
            ->orderBy('e.annee', 'DESC')
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
        $debut = $this->parserDate($dateDebut, 'date de début');
        $fin = $this->parserDate($dateFin, 'date de fin');
        if ($fin < $debut) {
            throw new DonneesInvalidesException(
                'La date de fin doit être postérieure ou égale à la date de début.',
            );
        }

        return [$debut, $fin];
    }

    private function parserDate(string $valeur, string $libelle): \DateTimeImmutable
    {
        $brut = trim($valeur);
        foreach (['Y-m-d', 'd/m/Y'] as $format) {
            $date = \DateTimeImmutable::createFromFormat('!'.$format, $brut);
            if ($date instanceof \DateTimeImmutable) {
                $erreurs = \DateTimeImmutable::getLastErrors();
                if (($erreurs['warning_count'] ?? 0) === 0 && ($erreurs['error_count'] ?? 0) === 0) {
                    return $date;
                }
            }
        }

        throw new DonneesInvalidesException(
            sprintf('La %s doit être au format AAAA-MM-JJ ou JJ/MM/AAAA.', $libelle),
        );
    }

    private function parserDateCellule(mixed $valeur): ?\DateTimeImmutable
    {
        if ($valeur instanceof \DateTimeInterface) {
            return \DateTimeImmutable::createFromInterface($valeur);
        }
        if ($valeur === null || $valeur === '') {
            return null;
        }
        $s = trim((string) $valeur);
        foreach (['Y-m-d', 'd/m/Y', 'Y-m-d H:i:s'] as $format) {
            $date = \DateTimeImmutable::createFromFormat('!'.$format, $s);
            if ($date instanceof \DateTimeImmutable) {
                return $date;
            }
        }

        return null;
    }

    /**
     * @return array<string, mixed>
     */
    private function serialiserPeriode(Periode $p): array
    {
        $mois = Mois::tryFrom($p->getMois());

        return [
            'id' => $p->getId(),
            'exercice_annee' => $p->getExercice()->getAnnee(),
            'mois' => $p->getMois(),
            'mois_libelle' => $mois?->libelle(),
            'date_situation' => $p->getDateSituation()?->format('Y-m-d'),
            'statut' => $p->getStatut()->value,
        ];
    }

    private function acteur(): ?Utilisateur
    {
        $u = $this->security->getUser();

        return $u instanceof Utilisateur ? $u : null;
    }

    /**
     * @param array<string, mixed> $ligne
     */
    private function cellule(array $ligne, string $cle): mixed
    {
        foreach ($ligne as $k => $v) {
            if (strtoupper((string) $k) === $cle) {
                return $v;
            }
        }

        return null;
    }

    private function texte(mixed $valeur): ?string
    {
        if ($valeur === null) {
            return null;
        }
        $s = trim((string) $valeur);

        return $s === '' ? null : $s;
    }

    private function entier(mixed $valeur): ?int
    {
        if ($valeur === null || $valeur === '') {
            return null;
        }
        if (is_numeric($valeur)) {
            return (int) $valeur;
        }

        return null;
    }

    private function montant(mixed $valeur): string
    {
        if ($valeur === null || $valeur === '') {
            return '0.00';
        }
        if (is_string($valeur)) {
            $valeur = str_replace([' ', ','], ['', '.'], $valeur);
        }
        if (!is_numeric($valeur)) {
            return '0.00';
        }

        return number_format((float) $valeur, 2, '.', '');
    }
}
