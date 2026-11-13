<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Service;

use App\Module\ServiceOperationsFinancieres\Entite\Import\IgOperation;
use App\Module\ServiceOperationsFinancieres\Entite\Import\LotImport;
use App\Module\ServiceOperationsFinancieres\Entite\Import\MontantSaisiCompte;
use App\Module\ServiceOperationsFinancieres\Entite\Periode;
use App\Module\ServiceOperationsFinancieres\Entite\Recette\CompteDouane;
use App\Module\ServiceOperationsFinancieres\Enum\FormatImport;
use App\Module\ServiceOperationsFinancieres\Enum\Mois;
use App\Module\ServiceOperationsFinancieres\Enum\SensMontantCompte;
use App\Module\ServiceOperationsFinancieres\Enum\StatutLotImport;
use App\Module\ServiceOperationsFinancieres\Enum\TypeCompteDouane;
use App\Module\ServiceOperationsFinancieres\Repository\CompteDouaneRepository;
use App\Module\ServiceOperationsFinancieres\Repository\IgOperationRepository;
use App\Module\ServiceOperationsFinancieres\Repository\LotImportRepository;
use App\Module\ServiceOperationsFinancieres\Repository\MontantSaisiCompteRepository;
use App\Module\ServiceOperationsFinancieres\Repository\PeriodeRepository;
use App\Module\ServiceOperationsFinancieres\Repository\ScriptPoolSof;
use App\Shared\Entite\Utilisateur;
use App\Shared\Exception\DonneesInvalidesException;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\SecurityBundle\Security;

/**
 * Imports › Extractions IG › Comptes douanes.
 * — F1 : opérations VIDR → ig_operation (4784-*, 1812-*, hors RUSID)
 * — F8 : RUSID 4663-218 → montant_saisi_compte
 */
class IgOperationDouanesService
{
    private const SOURCE = 'ig-douanes';
    private const ETAPE = 'ig_operation';
    private const COMPTE_RUSID = '4663-218';

    public function __construct(
        private readonly ScriptPoolSof $scriptPoolSof,
        private readonly CompteDouaneRepository $compteDouaneRepository,
        private readonly PeriodeRepository $periodeRepository,
        private readonly LotImportRepository $lotImportRepository,
        private readonly IgOperationRepository $igOperationRepository,
        private readonly MontantSaisiCompteRepository $montantSaisiCompteRepository,
        private readonly LotImportService $lotImportService,
        private readonly EntityManagerInterface $em,
        private readonly Security $security,
        private readonly JournalAuditService $journalAuditService,
    ) {
    }

    /**
     * Grille compte × montant (maquette ig-douanes).
     *
     * @return array<string, mixed>
     */
    public function listerGrille(?int $periodeId = null): array
    {
        $periode = $this->resoudrePeriode($periodeId);
        if (!$periode instanceof Periode || $periode->getId() === null) {
            return [
                'periode' => null,
                'lignes' => [],
                'rusid' => null,
                'message' => 'Aucune période SROT.',
            ];
        }

        $lignes = [];
        foreach ($this->comptesHorsRusid() as $c) {
            $lot = $this->trouverLotActif($periode->getId(), $c->getCompte());
            $nb = $lot?->getId() !== null
                ? $this->igOperationRepository->compterParLot($lot->getId())
                : 0;
            $bancaireSeulement = str_starts_with($c->getCompte(), '4784-1');
            $lignes[] = [
                'compte' => $c->getCompte(),
                'libelle' => $c->getLibelleCompte(),
                'type' => $c->getType()->value,
                'type_libelle' => $c->getType()->libelle(),
                'montant' => $lot?->getMontantTotal() ?? '0.00',
                'nb_lignes' => $nb,
                'operations' => $bancaireSeulement ? 'Bancaires seulement' : 'Toutes',
                'bancaire_seulement' => $bancaireSeulement,
                'lot' => $lot instanceof LotImport && $lot->getId() !== null
                    ? $this->lotImportService->obtenir($lot->getId())
                    : null,
            ];
        }

        $rusid = $this->montantSaisiCompteRepository->trouver(
            $periode->getId(),
            self::COMPTE_RUSID,
            SensMontantCompte::RECETTE,
        );

        return [
            'periode' => $this->serialiserPeriode($periode),
            'lignes' => $lignes,
            'rusid' => $rusid instanceof MontantSaisiCompte
                ? [
                    'compte' => self::COMPTE_RUSID,
                    'libelle' => 'RUSID',
                    'montant' => $rusid->getMontant(),
                    'sens' => $rusid->getSens()->value,
                    'source' => $rusid->getSource(),
                ]
                : [
                    'compte' => self::COMPTE_RUSID,
                    'libelle' => 'RUSID',
                    'montant' => '0.00',
                    'sens' => SensMontantCompte::RECETTE->value,
                    'source' => null,
                ],
            'message' => null,
        ];
    }

    /**
     * Détail opérations d'un compte (lot F1 ACTIF).
     *
     * @return array<string, mixed>
     */
    public function obtenirCompte(string $compte, ?int $periodeId = null): array
    {
        $compte = trim($compte);
        $def = $this->exigerCompteHorsRusid($compte);
        $periode = $this->resoudrePeriode($periodeId);
        if (!$periode instanceof Periode || $periode->getId() === null) {
            throw new DonneesInvalidesException('Aucune période SROT.');
        }

        $lot = $this->trouverLotActif($periode->getId(), $compte);
        if (!$lot instanceof LotImport || $lot->getId() === null) {
            return [
                'periode' => $this->serialiserPeriode($periode),
                'compte' => $compte,
                'libelle' => $def->getLibelleCompte(),
                'lot' => null,
                'lignes' => [],
                'nombre' => 0,
                'total' => '0.00',
                'message' => 'Aucun lot F1 actif. Lancez une extraction.',
            ];
        }

        $entites = $this->igOperationRepository->listerParLot($lot->getId());
        $lignes = [];
        $total = '0.00';
        foreach ($entites as $e) {
            $row = $this->serialiserLigne($e);
            $lignes[] = $row;
            $total = bcadd($total, (string) ($row['m_regl'] ?? '0'), 2);
        }

        return [
            'periode' => $this->serialiserPeriode($periode),
            'compte' => $compte,
            'libelle' => $def->getLibelleCompte(),
            'lot' => $this->lotImportService->obtenir($lot->getId()),
            'lignes' => $lignes,
            'nombre' => count($lignes),
            'total' => $total,
            'message' => $lignes === [] ? 'Aucune opération.' : null,
        ];
    }

    /**
     * Extraction Oracle → lots F1 (VIDR) + montant F8 (RUSID).
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

        $comptes = array_map(
            static fn (CompteDouane $c): string => $c->getCompte(),
            $this->comptesHorsRusid(),
        );

        $dateDeb = $debut->format('d/m/Y');
        $dateFinFmt = $fin->format('d/m/Y');

        try {
            $brutes = $this->scriptPoolSof->extraireRecettesDouanieresCompte(
                $dateDeb,
                $dateFinFmt,
                $comptes,
            );
        } catch (\Throwable $e) {
            throw new DonneesInvalidesException(
                'Extraction IG VIDR douanes impossible : '.$e->getMessage(),
            );
        }

        /** @var array<string, list<array<string, mixed>>> $parCompte */
        $parCompte = [];
        foreach ($comptes as $cp) {
            $parCompte[$cp] = [];
        }
        foreach ($brutes as $ligne) {
            $n = $this->normaliserLigne($ligne);
            $cp = $n['c_it'] ?? '';
            if ($cp === '' || !isset($parCompte[$cp])) {
                continue;
            }
            // 4784-1* : bancaire seulement (déjà filtré SQL, filet de sécurité)
            if (str_starts_with($cp, '4784-1') && strtoupper((string) ($n['c_nop'] ?? '')) !== 'B') {
                continue;
            }
            $parCompte[$cp][] = $n;
        }

        $acteur = $this->acteur();
        $resultats = [];
        foreach ($this->comptesHorsRusid() as $def) {
            $cp = $def->getCompte();
            $lignes = $parCompte[$cp] ?? [];
            $lot = $this->creerLotCompte($periode, $def, $lignes, $debut, $fin, $acteur);
            $resultats[] = [
                'compte' => $cp,
                'libelle' => $def->getLibelleCompte(),
                'lot_id' => $lot->getId(),
                'nb_lignes' => $lot->getNbLignes(),
                'montant_total' => $lot->getMontantTotal(),
            ];
        }

        $rusid = $this->importerRusid($periode, $dateDeb, $dateFinFmt);

        $this->journalAuditService->enregistrer(
            'IMPORTER',
            'ig_operation',
            'douanes/'.$periode->getId(),
            $acteur,
            null,
            [
                'date_debut' => $debut->format('Y-m-d'),
                'date_fin' => $fin->format('Y-m-d'),
                'comptes' => count($resultats),
                'nb_lignes' => array_sum(array_column($resultats, 'nb_lignes')),
                'rusid' => $rusid['montant'],
            ],
        );

        return [
            'periode' => $this->serialiserPeriode($periode),
            'date_debut' => $debut->format('Y-m-d'),
            'date_fin' => $fin->format('Y-m-d'),
            'comptes' => $resultats,
            'rusid' => $rusid,
            'message' => null,
        ];
    }

    /**
     * @return array{compte: string, montant: string, sens: string, source: string}
     */
    private function importerRusid(Periode $periode, string $dateDeb, string $dateFinFmt): array
    {
        try {
            $lignes = $this->scriptPoolSof->extraireRecettesDouanieresRusid($dateDeb, $dateFinFmt);
        } catch (\Throwable $e) {
            throw new DonneesInvalidesException(
                'Extraction RUSID (F8) impossible : '.$e->getMessage(),
            );
        }

        $moisPeriode = $periode->getMois();
        $totalMillions = '0.00';
        foreach ($lignes as $ligne) {
            $mm = (int) ($this->cellule($ligne, 'MM') ?? 0);
            if ($mm !== 0 && $mm !== $moisPeriode) {
                continue;
            }
            $m = $this->montant($this->cellule($ligne, 'M_OPER'));
            $totalMillions = bcadd($totalMillions, $m, 2);
        }
        // MCPT renvoie des millions → FCFA
        $totalFcfa = bcmul($totalMillions, '1000000', 2);

        $pid = $periode->getId() ?? 0;
        $row = $this->montantSaisiCompteRepository->trouver(
            $pid,
            self::COMPTE_RUSID,
            SensMontantCompte::RECETTE,
        );
        if (!$row instanceof MontantSaisiCompte) {
            $row = new MontantSaisiCompte(
                $periode,
                self::COMPTE_RUSID,
                SensMontantCompte::RECETTE,
                $totalFcfa,
                'F8',
            );
            $this->em->persist($row);
        } else {
            $row->setMontant($totalFcfa);
            $row->setSource('F8');
        }

        // Lot F8 pour historique des imports (libérer l'index unique ACTIF avant insert)
        foreach ($this->listerLotsActifsFormat($pid, FormatImport::F8) as $ancien) {
            $p = $ancien->getParametres();
            if (($p['compte'] ?? null) === self::COMPTE_RUSID
                || ($p['etape'] ?? null) === 'montant_saisi_compte'
            ) {
                $ancien->setStatut(StatutLotImport::REMPLACE);
            }
        }
        $this->em->flush();

        $lot = new LotImport($periode, FormatImport::F8, [
            'source' => self::SOURCE,
            'source_libelle' => 'RUSID 4663-218',
            'compte' => self::COMPTE_RUSID,
            'etape' => 'montant_saisi_compte',
            'date_debut' => null,
            'date_fin' => null,
        ]);
        $lot->setNbLignes(1);
        $lot->setMontantTotal($totalFcfa);
        $lot->setFichierNom(sprintf('rusid_%s_%s', $dateDeb, $dateFinFmt));
        $acteur = $this->acteur();
        if ($acteur instanceof Utilisateur) {
            $lot->setImportePar($acteur);
        }
        $this->em->persist($lot);
        $this->em->flush();

        return [
            'compte' => self::COMPTE_RUSID,
            'montant' => $totalFcfa,
            'sens' => SensMontantCompte::RECETTE->value,
            'source' => 'F8',
        ];
    }

    /**
     * @param list<array<string, mixed>> $lignes
     */
    private function creerLotCompte(
        Periode $periode,
        CompteDouane $def,
        array $lignes,
        \DateTimeImmutable $debut,
        \DateTimeImmutable $fin,
        ?Utilisateur $acteur,
    ): LotImport {
        $params = [
            'source' => self::SOURCE,
            'source_libelle' => 'Comptes douanes · '.$def->getLibelleCompte(),
            'etape' => self::ETAPE,
            'compte' => $def->getCompte(),
            'date_debut' => $debut->format('Y-m-d'),
            'date_fin' => $fin->format('Y-m-d'),
        ];

        foreach ($this->listerLotsActifsCompte($periode->getId() ?? 0, $def->getCompte()) as $ancien) {
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
            'ig_dou_%s_%s_%s',
            str_replace('-', '', $def->getCompte()),
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
     * @return list<CompteDouane>
     */
    private function comptesHorsRusid(): array
    {
        return array_values(array_filter(
            $this->compteDouaneRepository->listerTous(),
            static fn (CompteDouane $c): bool => $c->getType() !== TypeCompteDouane::RUSID,
        ));
    }

    private function exigerCompteHorsRusid(string $compte): CompteDouane
    {
        $c = $this->compteDouaneRepository->trouverParCompte($compte);
        if (!$c instanceof CompteDouane || $c->getType() === TypeCompteDouane::RUSID) {
            throw new DonneesInvalidesException(sprintf('Compte douane inconnu : %s.', $compte));
        }

        return $c;
    }

    private function trouverLotActif(int $periodeId, string $compte): ?LotImport
    {
        return $this->listerLotsActifsCompte($periodeId, $compte)[0] ?? null;
    }

    /**
     * @return list<LotImport>
     */
    private function listerLotsActifsCompte(int $periodeId, string $compte): array
    {
        $out = [];
        foreach ($this->listerLotsActifsFormat($periodeId, FormatImport::F1) as $lot) {
            $p = $lot->getParametres();
            if (($p['source'] ?? null) !== self::SOURCE || ($p['etape'] ?? null) !== self::ETAPE) {
                continue;
            }
            if (($p['compte'] ?? null) === $compte) {
                $out[] = $lot;
            }
        }

        return $out;
    }

    /**
     * @return list<LotImport>
     */
    private function listerLotsActifsFormat(int $periodeId, FormatImport $format): array
    {
        /** @var list<LotImport> $candidats */
        $candidats = $this->lotImportRepository->createQueryBuilder('l')
            ->andWhere('l.periode = :periodeId')
            ->andWhere('l.format = :format')
            ->andWhere('l.statut = :actif')
            ->setParameter('periodeId', $periodeId)
            ->setParameter('format', $format)
            ->setParameter('actif', StatutLotImport::ACTIF)
            ->orderBy('l.importeLe', 'DESC')
            ->getQuery()
            ->getResult();

        return $candidats;
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
        $debut = \DateTimeImmutable::createFromFormat('Y-m-d', trim($dateDebut))
            ?: \DateTimeImmutable::createFromFormat('d/m/Y', trim($dateDebut));
        $fin = \DateTimeImmutable::createFromFormat('Y-m-d', trim($dateFin))
            ?: \DateTimeImmutable::createFromFormat('d/m/Y', trim($dateFin));
        if (!$debut instanceof \DateTimeImmutable || !$fin instanceof \DateTimeImmutable) {
            throw new DonneesInvalidesException('Dates invalides (attendu AAAA-MM-JJ).');
        }
        $debut = $debut->setTime(0, 0);
        $fin = $fin->setTime(0, 0);
        if ($fin < $debut) {
            throw new DonneesInvalidesException('La date de fin doit être ≥ date de début.');
        }

        return [$debut, $fin];
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

        return $t === '' ? null : $t;
    }

    private function entier(mixed $v): ?int
    {
        if ($v === null || $v === '') {
            return null;
        }
        if (is_numeric($v)) {
            return (int) $v;
        }

        return null;
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

    private function parserDateCellule(mixed $v): ?\DateTimeImmutable
    {
        if ($v instanceof \DateTimeInterface) {
            return \DateTimeImmutable::createFromInterface($v);
        }
        if ($v === null || $v === '') {
            return null;
        }
        $s = trim((string) $v);
        foreach (['Y-m-d', 'd/m/Y', 'd-m-Y'] as $fmt) {
            $d = \DateTimeImmutable::createFromFormat($fmt, $s);
            if ($d instanceof \DateTimeImmutable) {
                return $d->setTime(0, 0);
            }
        }

        return null;
    }
}
