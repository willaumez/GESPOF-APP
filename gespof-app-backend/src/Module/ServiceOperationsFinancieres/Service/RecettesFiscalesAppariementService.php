<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Service;

use App\Module\ServiceOperationsFinancieres\Entite\Import\IgOperation;
use App\Module\ServiceOperationsFinancieres\Entite\Import\LotImport;
use App\Module\ServiceOperationsFinancieres\Entite\Periode;
use App\Module\ServiceOperationsFinancieres\Entite\Referentiel\TableFiscaleCompte;
use App\Module\ServiceOperationsFinancieres\Entite\Referentiel\TableFiscaleLigne;
use App\Module\ServiceOperationsFinancieres\Enum\FormatImport;
use App\Module\ServiceOperationsFinancieres\Enum\StatutLotImport;
use App\Module\ServiceOperationsFinancieres\Repository\IgOperationRepository;
use App\Module\ServiceOperationsFinancieres\Repository\LotImportRepository;
use App\Module\ServiceOperationsFinancieres\Repository\PeriodeRepository;
use App\Module\ServiceOperationsFinancieres\Repository\SocietePetroliereRepository;
use App\Module\ServiceOperationsFinancieres\Repository\TableFiscaleCompteRepository;
use App\Module\ServiceOperationsFinancieres\Repository\TableFiscaleLigneRepository;
use App\Module\ServiceOperationsFinancieres\Support\RecettesImpotsFiltres;

/**
 * Recettes › Fiscales › Appariement transferts ↔ prises en charge (SPEC §5.3).
 */
class RecettesFiscalesAppariementService
{
    private const SOURCE_FISCAL = 'ig-fiscal';
    private const SOURCE_PETROLE = 'ig-petrole';
    private const CODE_RF_DEFAUT = 'RF137';

    public function __construct(
        private readonly PeriodeRepository $periodeRepository,
        private readonly LotImportRepository $lotImportRepository,
        private readonly IgOperationRepository $igOperationRepository,
        private readonly TableFiscaleCompteRepository $tableCompteRepository,
        private readonly TableFiscaleLigneRepository $tableLigneRepository,
        private readonly SocietePetroliereRepository $societePetroliereRepository,
        private readonly LotImportService $lotImportService,
    ) {
    }

    /**
     * @return array<string, mixed>
     */
    public function obtenir(?int $periodeId = null): array
    {
        $periode = $this->resoudrePeriode($periodeId);
        if (!$periode instanceof Periode || $periode->getId() === null) {
            return [
                'periode' => null,
                'lot' => null,
                'apparies' => [],
                'ambigus' => [],
                'non_apparies' => [],
                'stats' => $this->statsVides(),
                'message' => 'Aucune période SROT.',
            ];
        }

        $lot = $this->lotFiscalActif($periode->getId());
        if (!$lot instanceof LotImport || $lot->getId() === null) {
            return [
                'periode' => $this->serialiserPeriode($periode),
                'lot' => null,
                'apparies' => [],
                'ambigus' => [],
                'non_apparies' => [],
                'stats' => $this->statsVides(),
                'message' => 'Aucun lot IG recettes fiscales (ig-fiscal) actif. Importez le preset ig-recettes-fiscales.',
            ];
        }

        $ops = $this->igOperationRepository->listerParLot($lot->getId(), 100000);
        $retenues = [];
        foreach ($ops as $op) {
            if (!$op instanceof IgOperation) {
                continue;
            }
            if (!RecettesImpotsFiltres::operationRetenue($op->getCIt(), $op->getCNop(), $op->getCNat())) {
                continue;
            }
            $retenues[] = $op;
        }

        $transferts = [];
        $pecs = [];
        foreach ($retenues as $op) {
            if (RecettesImpotsFiltres::estTransfert($op->getCIt())) {
                $transferts[] = $op;
            } elseif (RecettesImpotsFiltres::estPriseEnCharge($op->getCIt())) {
                $pecs[] = $op;
            }
        }

        $nReglPetrole = $this->indexNReglPetrole($periode->getId());
        $matriculesPetrole = $this->matriculesPetroliers();
        $indexComptes = $this->indexComptesTables();
        $indexRf = $this->indexRfParTableNature();

        /** @var array<string, list<IgOperation>> $pecParCle */
        $pecParCle = [];
        foreach ($pecs as $pec) {
            $cle = $this->cleAppariement($pec);
            if ($cle === null) {
                continue;
            }
            $pecParCle[$cle][] = $pec;
        }

        /** @var array<int, true> $pecUtilisees */
        $pecUtilisees = [];
        $apparies = [];
        $ambigus = [];
        $nonApparies = [];

        foreach ($transferts as $tr) {
            $cle = $this->cleAppariement($tr);
            $candidats = [];
            if ($cle !== null) {
                foreach ($pecParCle[$cle] ?? [] as $pec) {
                    if ($pec->getId() !== null && isset($pecUtilisees[$pec->getId()])) {
                        continue;
                    }
                    $candidats[] = $pec;
                }
            }

            $petrole = $this->estPetrole($tr, $nReglPetrole, $matriculesPetrole);
            $base = $this->serialiserOp($tr) + ['petrole' => $petrole];

            if ($candidats === []) {
                // Précompte 1812-211 : pas de PEC obligatoire.
                if (RecettesImpotsFiltres::estPrecompteTva($tr->getCIt())) {
                    $rf = $this->resoudreCodeRf($tr, null, $petrole, $indexComptes, $indexRf);
                    $apparies[] = $base + [
                        'pec' => null,
                        'code_rf' => $rf,
                        'motif' => 'PRECOMPTE_TVA',
                    ];
                    continue;
                }
                $nonApparies[] = $base + [
                    'pec' => null,
                    'code_rf' => null,
                    'motif' => 'SANS_PEC',
                    'candidats' => [],
                ];
                continue;
            }

            if (\count($candidats) > 1) {
                $ambigus[] = $base + [
                    'pec' => null,
                    'code_rf' => null,
                    'motif' => 'AMBIGU',
                    'candidats' => array_map(fn (IgOperation $p): array => $this->serialiserOp($p), $candidats),
                ];
                continue;
            }

            $pec = $candidats[0];
            if ($pec->getId() !== null) {
                $pecUtilisees[$pec->getId()] = true;
            }
            $rf = $this->resoudreCodeRf($tr, $pec, $petrole, $indexComptes, $indexRf);
            $apparies[] = $base + [
                'pec' => $this->serialiserOp($pec),
                'code_rf' => $rf,
                'motif' => 'APPARIE',
            ];
        }

        // PEC non utilisées (info).
        $pecOrphelines = [];
        foreach ($pecs as $pec) {
            if ($pec->getId() !== null && !isset($pecUtilisees[$pec->getId()])) {
                $pecOrphelines[] = $this->serialiserOp($pec);
            }
        }

        return [
            'periode' => $this->serialiserPeriode($periode),
            'lot' => $this->lotImportService->obtenir($lot->getId()),
            'apparies' => $apparies,
            'ambigus' => $ambigus,
            'non_apparies' => $nonApparies,
            'pec_orphelines' => $pecOrphelines,
            'stats' => [
                'nb_ops_lot' => \count($ops),
                'nb_retenues' => \count($retenues),
                'nb_transferts' => \count($transferts),
                'nb_pec' => \count($pecs),
                'nb_apparies' => \count($apparies),
                'nb_ambigus' => \count($ambigus),
                'nb_non_apparies' => \count($nonApparies),
                'nb_pec_orphelines' => \count($pecOrphelines),
            ],
            'message' => null,
        ];
    }

    /**
     * @param array<string, string>      $indexComptes compte → table
     * @param array<string, string>      $indexRf      table|nature → code_rf
     */
    private function resoudreCodeRf(
        IgOperation $transfert,
        ?IgOperation $pec,
        bool $petrole,
        array $indexComptes,
        array $indexRf,
    ): string {
        $particulier = RecettesImpotsFiltres::codeRfParticulier(
            $transfert->getCIt(),
            $petrole,
        );
        if ($particulier !== null) {
            return $particulier;
        }

        $compte = $pec?->getCIt() ?? $transfert->getCIt();
        $nature = $pec?->getCNat() ?? $transfert->getCNat();
        $table = $indexComptes[strtoupper(trim((string) $compte))] ?? null;
        if ($table === null || $nature === null || trim($nature) === '') {
            return self::CODE_RF_DEFAUT;
        }
        $cle = $table.'|'.strtoupper(trim($nature));
        $rf = $indexRf[$cle] ?? null;
        if ($rf === null || $rf === '') {
            // Nature partielle : préfixe
            foreach ($indexRf as $k => $code) {
                if (str_starts_with($k, $table.'|') && str_contains($k, strtoupper(trim($nature)))) {
                    return $code;
                }
            }

            return self::CODE_RF_DEFAUT;
        }

        return $rf;
    }

    private function cleAppariement(IgOperation $op): ?string
    {
        $mattir = trim((string) $op->getNMattir());
        $montant = $op->getMRegl() ?? '0.00';
        if ($mattir === '' || 0 === bccomp($montant, '0.00', 2)) {
            return null;
        }

        return mb_strtolower($mattir).'|'.number_format((float) $montant, 2, '.', '');
    }

    /**
     * @param array<string, true> $nReglPetrole
     * @param array<string, true> $matriculesPetrole
     */
    private function estPetrole(IgOperation $op, array $nReglPetrole, array $matriculesPetrole): bool
    {
        $nRegl = trim((string) $op->getNRegl());
        if ($nRegl !== '' && isset($nReglPetrole[$nRegl])) {
            return true;
        }
        $mattir = trim((string) $op->getNMattir());

        return $mattir !== '' && isset($matriculesPetrole[mb_strtoupper($mattir)]);
    }

    /**
     * @return array<string, true>
     */
    private function indexNReglPetrole(int $periodeId): array
    {
        $out = [];
        $lot = $this->lotActif($periodeId, [self::SOURCE_PETROLE], [FormatImport::F1]);
        if (!$lot instanceof LotImport || $lot->getId() === null) {
            return $out;
        }
        foreach ($this->igOperationRepository->listerParLot($lot->getId(), 50000) as $op) {
            $n = trim((string) $op->getNRegl());
            if ($n !== '') {
                $out[$n] = true;
            }
        }

        return $out;
    }

    /**
     * @return array<string, true>
     */
    private function matriculesPetroliers(): array
    {
        $out = [];
        foreach ($this->societePetroliereRepository->listerParMatricule() as $s) {
            if ($s->isPetrole()) {
                $out[mb_strtoupper($s->getMatricule())] = true;
            }
        }

        return $out;
    }

    /**
     * @return array<string, string>
     */
    private function indexComptesTables(): array
    {
        $out = [];
        foreach ($this->tableCompteRepository->lister() as $c) {
            if ($c instanceof TableFiscaleCompte) {
                $out[strtoupper($c->getCompte())] = $c->getTableCode();
            }
        }

        return $out;
    }

    /**
     * @return array<string, string>
     */
    private function indexRfParTableNature(): array
    {
        $out = [];
        foreach ($this->tableLigneRepository->lister() as $l) {
            if ($l instanceof TableFiscaleLigne) {
                $out[$l->getTableCode().'|'.strtoupper($l->getNature())] = $l->getCodeRf();
            }
        }

        return $out;
    }

    private function lotFiscalActif(int $periodeId): ?LotImport
    {
        return $this->lotActif($periodeId, [self::SOURCE_FISCAL], [FormatImport::F1, FormatImport::F13]);
    }

    /**
     * @param list<string>       $sources
     * @param list<FormatImport> $formats
     */
    private function lotActif(int $periodeId, array $sources, array $formats): ?LotImport
    {
        /** @var list<LotImport> $lots */
        $lots = $this->lotImportRepository->createQueryBuilder('l')
            ->andWhere('IDENTITY(l.periode) = :pid')
            ->andWhere('l.statut = :actif')
            ->andWhere('l.format IN (:formats)')
            ->setParameter('pid', $periodeId)
            ->setParameter('actif', StatutLotImport::ACTIF)
            ->setParameter('formats', $formats)
            ->orderBy('l.importeLe', 'DESC')
            ->getQuery()
            ->getResult();

        foreach ($lots as $lot) {
            $source = (string) ($lot->getParametres()['source'] ?? '');
            if (in_array($source, $sources, true)) {
                return $lot;
            }
            // Fallback : preset dans parametres.
            $preset = (string) ($lot->getParametres()['preset'] ?? '');
            if ($preset === 'ig-recettes-fiscales' && in_array('ig-fiscal', $sources, true)) {
                return $lot;
            }
        }

        return null;
    }

    /**
     * @return array<string, mixed>
     */
    private function serialiserOp(IgOperation $o): array
    {
        return [
            'id' => $o->getId(),
            'd_cpta' => $o->getDCpta()?->format('Y-m-d'),
            'n_regl' => $o->getNRegl(),
            'n_mattir' => $o->getNMattir(),
            'l_tiers' => $o->getLTiers() ?? $o->getLNp(),
            'c_it' => $o->getCIt(),
            'c_nat' => $o->getCNat(),
            'c_nop' => $o->getCNop(),
            'm_regl' => $o->getMRegl(),
        ];
    }

    /**
     * @return array<string, int>
     */
    private function statsVides(): array
    {
        return [
            'nb_ops_lot' => 0,
            'nb_retenues' => 0,
            'nb_transferts' => 0,
            'nb_pec' => 0,
            'nb_apparies' => 0,
            'nb_ambigus' => 0,
            'nb_non_apparies' => 0,
            'nb_pec_orphelines' => 0,
        ];
    }

    private function resoudrePeriode(?int $periodeId): ?Periode
    {
        if ($periodeId !== null && $periodeId > 0) {
            return $this->periodeRepository->find($periodeId);
        }
        /** @var list<Periode> $periodes */
        $periodes = $this->periodeRepository->createQueryBuilder('p')
            ->leftJoin('p.exercice', 'e')->addSelect('e')
            ->orderBy('e.annee', 'DESC')->addOrderBy('p.mois', 'DESC')
            ->setMaxResults(1)->getQuery()->getResult();

        return $periodes[0] ?? null;
    }

    /**
     * @return array<string, mixed>
     */
    private function serialiserPeriode(Periode $p): array
    {
        return [
            'id' => $p->getId(),
            'exercice_annee' => $p->getExercice()->getAnnee(),
            'mois' => $p->getMois(),
        ];
    }
}
