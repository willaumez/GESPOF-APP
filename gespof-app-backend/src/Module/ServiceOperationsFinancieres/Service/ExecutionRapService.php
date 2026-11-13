<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Service;

use App\Module\ServiceOperationsFinancieres\Entite\Import\IgOperation;
use App\Module\ServiceOperationsFinancieres\Entite\Periode;
use App\Module\ServiceOperationsFinancieres\Entite\Referentiel\RapAnterieurLigne;
use App\Module\ServiceOperationsFinancieres\Enum\StatutLotImport;
use App\Module\ServiceOperationsFinancieres\Repository\IgOperationRepository;
use App\Module\ServiceOperationsFinancieres\Repository\LotImportRepository;
use App\Module\ServiceOperationsFinancieres\Repository\PeriodeRepository;
use App\Module\ServiceOperationsFinancieres\Repository\RapAnterieurLotRepository;
use App\Module\ServiceOperationsFinancieres\Support\ClassementCreditDelegue;
use App\Module\ServiceOperationsFinancieres\Support\ExecutionRapCalcul;
use App\Shared\Exception\DonneesInvalidesException;

/**
 * Situation des RAP — SPEC §10.1 (Lot 8).
 * Sources actuelles : RAP antérieurs (paramétrage) + CDEL (ig-cdel).
 * XRAV / RAP avant BOP : branchés dès lots dc-rap-bop disponibles.
 */
class ExecutionRapService
{
    public function __construct(
        private readonly PeriodeRepository $periodeRepository,
        private readonly RapAnterieurLotRepository $rapAnterieurLotRepository,
        private readonly LotImportRepository $lotImportRepository,
        private readonly IgOperationRepository $igOperationRepository,
        private readonly CalculRapService $calculRapService,
    ) {
    }

    /**
     * @return array<string, mixed>
     */
    public function situation(?int $periodeId = null, ?string $vue = null): array
    {
        $periode = $this->exigerPeriode($periodeId);
        $annee = $periode->getExercice()->getAnnee();
        $dateValeur = $periode->getDateSituation()
            ?? new \DateTimeImmutable(sprintf('%d-%02d-28', $annee, $periode->getMois()));
        $delai = $periode->getExercice()->getDelaiArriereJours();

        $lignes = [];
        $exclus = ['rap_negatif' => 0, 'filtre' => 0];

        // 1. RAP antérieurs (proxy situation jusqu'à XRAV)
        $lotRap = $this->rapAnterieurLotRepository->trouverDernier($annee);
        if ($lotRap !== null) {
            foreach ($lotRap->getLignes() as $l) {
                if (!$l instanceof RapAnterieurLigne) {
                    continue;
                }
                $avantBop = strtoupper((string) $l->getCCateg()) === 'ENT'
                    && $l->getExercice() < $annee; // heuristique
                $filtre = $this->calculRapService->filtrer([
                    'nature' => $l->getNature(),
                    'c_categ' => $l->getCCateg(),
                    'mdr' => $l->getPayload()['mdr'] ?? null,
                    'ordonnance' => $l->getOrdonnance(),
                    'exercice' => $l->getExercice(),
                    'rap' => $l->getRap(),
                ], $avantBop, !$avantBop, false);
                if (!$filtre['retenue']) {
                    ++$exclus['filtre'];
                    continue;
                }
                if (bccomp($l->getRap(), '0.00', 2) < 0) {
                    ++$exclus['rap_negatif'];
                    continue;
                }
                $lignes[] = $this->normaliserLigneRap(
                    source: 'rap_anterieur',
                    ordonnance: $l->getOrdonnance(),
                    nLig: $l->getNLig(),
                    echeance: $l->getEcheance(),
                    dEmis: null,
                    exercice: $l->getExercice(),
                    titre: $l->getTitre(),
                    nature: $l->getNature(),
                    cCateg: $l->getCCateg(),
                    ministere: $l->getMinistere(),
                    beneficiaire: $l->getBeneficiaire(),
                    brut: $l->getBrut(),
                    rap: $l->getRap(),
                    anneeValeur: $annee,
                    dateValeur: $dateValeur,
                    delai: $delai,
                );
            }
        }

        // 2. CDEL (ig-cdel) — RAP > 0
        foreach ($this->lignesCdel($periode) as $op) {
            $montant = $op->getMRegl() ?? '0.00';
            $filtre = $this->calculRapService->filtrer([
                'nature' => $op->getCNat(),
                'c_categ' => 'ENT',
                'mdr' => $op->getCMdr(),
                'ordonnance' => $op->getNOp() ?? $op->getNRegl(),
                'exercice' => $annee,
                'rap' => $montant,
            ], false, false, true);
            if (!$filtre['retenue']) {
                if ($filtre['motif'] === 'RAP_NEGATIF_OU_NUL') {
                    ++$exclus['rap_negatif'];
                } else {
                    ++$exclus['filtre'];
                }
                continue;
            }
            $classement = ClassementCreditDelegue::classer(
                $op->getCRef1(),
                $periode->getExercice()->getPrefixeAd(),
            );
            $exLigne = $classement['type_exercice'] === ClassementCreditDelegue::TYPE_COURANT
                ? $annee
                : $annee - 1;
            $lignes[] = $this->normaliserLigneRap(
                source: 'cdel',
                ordonnance: (string) ($op->getNOp() ?? $op->getNRegl() ?? ''),
                nLig: $op->getNLigR() !== null ? (string) $op->getNLigR() : null,
                echeance: $op->getDCpta(),
                dEmis: $op->getDCpta(),
                exercice: $exLigne,
                titre: null,
                nature: $op->getCNat(),
                cCateg: 'ENT',
                ministere: null,
                beneficiaire: $op->getLTiers(),
                brut: $montant,
                rap: $montant,
                anneeValeur: $annee,
                dateValeur: $dateValeur,
                delai: $delai,
            );
        }

        usort(
            $lignes,
            static function (array $a, array $b): int {
                $t = ($a['type'] ?? '') <=> ($b['type'] ?? '');
                if ($t !== 0) {
                    return $t;
                }

                return ($a['echeance'] ?? '') <=> ($b['echeance'] ?? '');
            },
        );

        $vues = $this->agregerVues($lignes);
        $synthese = $this->syntheseRap($lignes);
        $vueNorm = $vue !== null && $vue !== '' ? strtoupper($vue) : null;
        $lignesFiltrees = $vueNorm === null
            ? $lignes
            : array_values(array_filter(
                $lignes,
                static fn (array $l): bool => ($l['vue'] ?? '') === $vueNorm,
            ));

        $totalRap = '0.00';
        $totalNegatifs = 0;
        foreach ($lignes as $l) {
            $totalRap = bcadd($totalRap, (string) $l['rap'], 2);
            if (bccomp((string) $l['rap'], '0.00', 2) < 0) {
                ++$totalNegatifs;
            }
        }

        return [
            'periode' => [
                'id' => $periode->getId(),
                'exercice_annee' => $annee,
                'mois' => $periode->getMois(),
                'date_valeur' => $dateValeur->format('Y-m-d'),
                'delai_arriere_jours' => $delai,
            ],
            'note' => 'XRAV (dc-rap-bop) indisponible : RAP antérieurs + CDEL ig-cdel. SPEC §10.1.',
            'kpis' => [
                'nb_lignes' => count($lignes),
                'total_rap' => $totalRap,
                'nb_rap_negatifs' => $totalNegatifs,
                'exclus_filtre' => $exclus['filtre'],
                'exclus_rap_negatif' => $exclus['rap_negatif'],
            ],
            'vues' => array_keys($vues),
            'vue' => $vueNorm,
            'agrege_vues' => $vues,
            'synthese' => $synthese,
            'lignes' => array_slice($lignesFiltrees, 0, 500),
            'lignes_tronquees' => count($lignesFiltrees) > 500,
        ];
    }

    /**
     * True si un RAP négatif subsiste (blocage validation §9).
     */
    public function aRapNegatif(?int $periodeId = null): bool
    {
        $s = $this->situation($periodeId);

        return ((int) ($s['kpis']['nb_rap_negatifs'] ?? 0)) > 0
            || ((int) ($s['kpis']['exclus_rap_negatif'] ?? 0)) > 0;
    }

    /**
     * @return list<IgOperation>
     */
    private function lignesCdel(Periode $periode): array
    {
        $lots = $this->lotImportRepository->lister($periode->getId(), StatutLotImport::ACTIF);
        $ids = [];
        foreach ($lots as $lot) {
            $source = (string) ($lot->getParametres()['source'] ?? '');
            if ($source === 'ig-cdel' || str_starts_with($source, 'ig-cdel')) {
                $ids[] = (int) $lot->getId();
            }
        }
        if ($ids === []) {
            return [];
        }

        /** @var list<IgOperation> $ops */
        $ops = $this->igOperationRepository->createQueryBuilder('o')
            ->andWhere('o.lot IN (:ids)')
            ->setParameter('ids', $ids)
            ->getQuery()
            ->getResult();

        return $ops;
    }

    /**
     * @return array<string, mixed>
     */
    private function normaliserLigneRap(
        string $source,
        string $ordonnance,
        ?string $nLig,
        ?\DateTimeInterface $echeance,
        ?\DateTimeInterface $dEmis,
        int $exercice,
        ?string $titre,
        ?string $nature,
        ?string $cCateg,
        ?string $ministere,
        ?string $beneficiaire,
        string $brut,
        string $rap,
        int $anneeValeur,
        \DateTimeInterface $dateValeur,
        int $delai,
    ): array {
        $decoupe = ExecutionRapCalcul::decouperRap($rap, $echeance, $dateValeur, $delai);
        $exLabel = ExecutionRapCalcul::exerciceCrnAnt($exercice, $anneeValeur);
        $type = ExecutionRapCalcul::typeTitre($titre);
        $categ = strtoupper(trim((string) $cCateg));
        if ($categ === '') {
            $categ = 'ENT';
        }

        return [
            'source' => $source,
            'ordonnance' => $ordonnance,
            'n_lig' => $nLig,
            'echeance' => $echeance?->format('Y-m-d'),
            'd_emis' => $dEmis?->format('Y-m-d'),
            'mois' => $dEmis?->format('n'),
            'exercice' => $exercice,
            'exercice_label' => $exLabel,
            'type' => $type,
            'invest' => ExecutionRapCalcul::estInvestissement($nature) ? 'Investissement' : 'Fonctionnement',
            'titre' => $titre,
            'nature' => $nature,
            'g_nat' => ExecutionRapCalcul::grandeNature($nature),
            'c_categ' => $categ,
            'ministere' => $ministere,
            'beneficiaire' => $beneficiaire,
            'brut' => $brut,
            'rap' => $rap,
            'arrieres' => $decoupe['arrieres'],
            'instances' => $decoupe['instances'],
            'statut' => $decoupe['statut'],
            'time_to_rap' => $decoupe['time_to_rap'],
            'vue' => ExecutionRapCalcul::cleVue($exLabel, $categ),
        ];
    }

    /**
     * @param list<array<string, mixed>> $lignes
     *
     * @return array<string, array{nb: int, rap: string, brut: string}>
     */
    private function agregerVues(array $lignes): array
    {
        $out = [];
        foreach ($lignes as $l) {
            $k = (string) $l['vue'];
            if (!isset($out[$k])) {
                $out[$k] = ['nb' => 0, 'rap' => '0.00', 'brut' => '0.00'];
            }
            ++$out[$k]['nb'];
            $out[$k]['rap'] = bcadd($out[$k]['rap'], (string) $l['rap'], 2);
            $out[$k]['brut'] = bcadd($out[$k]['brut'], (string) $l['brut'], 2);
        }
        ksort($out);

        return $out;
    }

    /**
     * RAP Synthèse — SPEC §10.2.7.
     *
     * @param list<array<string, mixed>> $lignes
     *
     * @return array{lignes: list<array<string, mixed>>, totaux: array<string, string>}
     */
    private function syntheseRap(array $lignes): array
    {
        /** @var array<string, string> $cells */
        $cells = [];
        $add = static function (string $categ, string $type, string $ex, string $rap) use (&$cells): void {
            $k = strtoupper($categ).'|'.$type.'|'.$ex;
            $cells[$k] = bcadd($cells[$k] ?? '0.00', $rap, 2);
        };

        $cdelCrn = '0.00';
        $cdelAnt = '0.00';
        foreach ($lignes as $l) {
            if (($l['source'] ?? '') === 'cdel') {
                if (($l['exercice_label'] ?? '') === 'CRN') {
                    $cdelCrn = bcadd($cdelCrn, (string) $l['rap'], 2);
                } else {
                    $cdelAnt = bcadd($cdelAnt, (string) $l['rap'], 2);
                }
                continue;
            }
            $add(
                (string) $l['c_categ'],
                (string) $l['type'],
                (string) $l['exercice_label'],
                (string) $l['rap'],
            );
        }

        $rows = [];
        foreach (['ENT', 'AGC', 'TPG'] as $cat) {
            foreach (['FCT', 'INV'] as $type) {
                foreach (['ANT', 'CRN'] as $ex) {
                    $k = $cat.'|'.$type.'|'.$ex;
                    $rows[] = [
                        'c_categ' => $cat,
                        'type' => $type,
                        'exercice' => $ex,
                        'rap' => $cells[$k] ?? '0.00',
                    ];
                }
            }
        }
        $rows[] = [
            'c_categ' => 'CDEL',
            'type' => '—',
            'exercice' => 'CRN',
            'rap' => $cdelCrn,
        ];
        $rows[] = [
            'c_categ' => 'CDEL',
            'type' => '—',
            'exercice' => 'ANT',
            'rap' => $cdelAnt,
        ];

        $ant = '0.00';
        $crn = '0.00';
        foreach ($rows as $r) {
            if ($r['exercice'] === 'ANT') {
                $ant = bcadd($ant, (string) $r['rap'], 2);
            } else {
                $crn = bcadd($crn, (string) $r['rap'], 2);
            }
        }

        return [
            'lignes' => $rows,
            'totaux' => [
                'antérieurs' => $ant,
                'exercice' => $crn,
                'total' => bcadd($ant, $crn, 2),
            ],
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
