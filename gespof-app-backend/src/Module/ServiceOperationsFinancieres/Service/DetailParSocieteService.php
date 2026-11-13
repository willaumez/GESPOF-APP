<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Service;

use App\Module\ServiceOperationsFinancieres\Entite\Import\IgOperation;
use App\Module\ServiceOperationsFinancieres\Entite\Import\LotImport;
use App\Module\ServiceOperationsFinancieres\Entite\Periode;
use App\Module\ServiceOperationsFinancieres\Enum\FormatImport;
use App\Module\ServiceOperationsFinancieres\Enum\StatutLotImport;
use App\Module\ServiceOperationsFinancieres\Enum\TypeRecetteTransfert;
use App\Module\ServiceOperationsFinancieres\Repository\IgOperationRepository;
use App\Module\ServiceOperationsFinancieres\Repository\LotImportRepository;
use App\Module\ServiceOperationsFinancieres\Repository\PeriodeRepository;
use App\Module\ServiceOperationsFinancieres\Repository\QualificationTransfertRepository;
use App\Module\ServiceOperationsFinancieres\Repository\SocietePetroliereRepository;

/**
 * Recettes › Pétrolières › Détail par société
 * (ig_operation × qualification_transfert × societe_petroliere).
 */
class DetailParSocieteService
{
    private const MOIS_COURTS = [
        1 => 'Janv.', 2 => 'Févr.', 3 => 'Mars', 4 => 'Avr.',
        5 => 'Mai', 6 => 'Juin', 7 => 'Juil.', 8 => 'Août',
        9 => 'Sept.', 10 => 'Oct.', 11 => 'Nov.', 12 => 'Déc.',
    ];

    /** @var list<TypeRecetteTransfert> */
    private const TYPES = [
        TypeRecetteTransfert::IS,
        TypeRecetteTransfert::RMP,
        TypeRecetteTransfert::DIVIDENDES,
        TypeRecetteTransfert::PROFIT_OIL,
        TypeRecetteTransfert::REDEVANCE_SUP,
        TypeRecetteTransfert::DISCOUNT_BONI,
        TypeRecetteTransfert::PIPES,
    ];

    public function __construct(
        private readonly PeriodeRepository $periodeRepository,
        private readonly LotImportRepository $lotImportRepository,
        private readonly IgOperationRepository $igOperationRepository,
        private readonly QualificationTransfertRepository $qualificationRepository,
        private readonly SocietePetroliereRepository $societeRepository,
    ) {
    }

    /**
     * @return array<string, mixed>
     */
    public function synthetiser(?int $periodeId = null, ?string $filtreSociete = null): array
    {
        $periode = $this->resoudrePeriode($periodeId);
        if (!$periode instanceof Periode || $periode->getId() === null) {
            return [
                'exercice_annee' => null,
                'mois_courant' => null,
                'mois_libelles' => array_values(self::MOIS_COURTS),
                'societes' => [],
                'groupes' => [],
                'totaux' => $this->zeros(),
                'message' => 'Aucune période SROT.',
            ];
        }

        $annee = $periode->getExercice()->getAnnee();
        $moisCourant = $periode->getMois();
        $periodes = $this->periodeRepository->listerParExercice($annee);

        /**
         * type → matricule → montants[12].
         *
         * @var array<string, array<string, list<string>>> $agg
         */
        $agg = [];
        /** @var array<string, array{nom: string, champ_nif: string|null}> $metaSoc */
        $metaSoc = [];

        foreach ($this->societeRepository->listerParMatricule() as $s) {
            if (!$s->isPetrole()) {
                continue;
            }
            $metaSoc[$s->getMatricule()] = [
                'nom' => $s->getNom(),
                'champ_nif' => $s->getChampNif(),
            ];
        }

        foreach ($periodes as $p) {
            $pid = $p->getId();
            if ($pid === null) {
                continue;
            }
            $mois = $p->getMois();
            if ($mois < 1 || $mois > 12) {
                continue;
            }
            $idx = $mois - 1;
            $lot = $this->trouverLot1812201($pid);
            if (!$lot instanceof LotImport || $lot->getId() === null) {
                continue;
            }

            $ops = $this->igOperationRepository->listerParLot($lot->getId());
            $ids = array_values(array_filter(array_map(
                static fn (IgOperation $o): ?int => $o->getId(),
                $ops,
            )));
            $qualifs = $this->qualificationRepository->indexerParOperations($ids);

            foreach ($ops as $op) {
                $oid = $op->getId();
                if ($oid === null) {
                    continue;
                }
                $q = $qualifs[$oid] ?? null;
                if ($q !== null && $q->isExclu()) {
                    continue;
                }
                $type = $q?->getTypeRecette() ?? TypeRecetteTransfert::NON_QUALIFIE;
                if (!$type->consolider()) {
                    continue;
                }

                $matricule = $q?->getSocieteMatricule() ?? $op->getNMattir();
                if ($matricule === null || trim($matricule) === '') {
                    $matricule = '_SANS_';
                } else {
                    $matricule = trim($matricule);
                }

                if (!isset($metaSoc[$matricule])) {
                    $ref = $matricule !== '_SANS_'
                        ? $this->societeRepository->trouverParMatricule($matricule)
                        : null;
                    $metaSoc[$matricule] = [
                        'nom' => $ref?->getNom()
                            ?? ($matricule === '_SANS_' ? 'Sans société' : ($op->getLTiers() ?? $matricule)),
                        'champ_nif' => $ref?->getChampNif(),
                    ];
                }

                $tv = $type->value;
                if (!isset($agg[$tv][$matricule])) {
                    $agg[$tv][$matricule] = $this->zeros();
                }
                $montant = $op->getMRegl() ?? '0.00';
                $agg[$tv][$matricule][$idx] = bcadd($agg[$tv][$matricule][$idx], $montant, 2);
            }
        }

        $filtre = $filtreSociete !== null && $filtreSociete !== '' && $filtreSociete !== 'Toutes'
            ? $filtreSociete
            : null;

        $groupes = [];
        $totaux = $this->zeros();

        // Liste des matricules à afficher sous chaque type (maquette : toutes les sociétés).
        $matsAffiches = [];
        foreach ($metaSoc as $mat => $_meta) {
            if ($filtre !== null && $mat !== $filtre) {
                continue;
            }
            if ($mat === '_SANS_') {
                continue;
            }
            $matsAffiches[] = $mat;
        }
        // « Sans société » uniquement s'il y a des montants sur au moins un type.
        if ($filtre === null && isset($metaSoc['_SANS_'])) {
            $aMontants = false;
            foreach (self::TYPES as $t) {
                if (isset($agg[$t->value]['_SANS_'])) {
                    $aMontants = true;
                    break;
                }
            }
            if ($aMontants) {
                $matsAffiches[] = '_SANS_';
            }
        }

        foreach (self::TYPES as $type) {
            $tv = $type->value;
            $enfants = [];
            $sommeType = $this->zeros();

            // Inclure aussi les matricules présents uniquement dans l'agrégat (hors référentiel).
            $mats = $matsAffiches;
            foreach (array_keys($agg[$tv] ?? []) as $mat) {
                if ($filtre !== null && $mat !== $filtre) {
                    continue;
                }
                if (!\in_array($mat, $mats, true)) {
                    $mats[] = $mat;
                }
            }

            foreach ($mats as $mat) {
                $montants = $agg[$tv][$mat] ?? $this->zeros();
                $meta = $metaSoc[$mat] ?? ['nom' => $mat, 'champ_nif' => null];
                $enfants[] = [
                    'matricule' => $mat === '_SANS_' ? null : $mat,
                    'nom' => $meta['nom'],
                    'champ_nif' => $meta['champ_nif'],
                    'montants' => $montants,
                ];
                for ($i = 0; $i < 12; ++$i) {
                    $sommeType[$i] = bcadd($sommeType[$i], $montants[$i], 2);
                }
            }

            usort(
                $enfants,
                static fn (array $a, array $b): int => strcmp($a['nom'], $b['nom']),
            );

            if ($enfants === [] && $filtre !== null) {
                continue;
            }

            $groupes[] = [
                'type' => $tv,
                'type_libelle' => $type->libelle(),
                'rubrique_code' => $type->rubriqueCode(),
                'montants' => $sommeType,
                'societes' => $enfants,
            ];

            for ($i = 0; $i < 12; ++$i) {
                $totaux[$i] = bcadd($totaux[$i], $sommeType[$i], 2);
            }
        }

        $societesFiltre = [];
        foreach ($metaSoc as $mat => $meta) {
            if ($mat === '_SANS_') {
                continue;
            }
            $societesFiltre[] = [
                'matricule' => $mat,
                'nom' => $meta['nom'],
            ];
        }
        usort(
            $societesFiltre,
            static fn (array $a, array $b): int => strcmp($a['nom'], $b['nom']),
        );

        return [
            'exercice_annee' => $annee,
            'mois_courant' => $moisCourant,
            'mois_libelles' => array_values(self::MOIS_COURTS),
            'societes' => $societesFiltre,
            'groupes' => $groupes,
            'totaux' => $totaux,
            'message' => null,
        ];
    }

    private function trouverLot1812201(int $periodeId): ?LotImport
    {
        /** @var list<LotImport> $candidats */
        $candidats = $this->lotImportRepository->createQueryBuilder('l')
            ->andWhere('l.periode = :pid')
            ->andWhere('l.format = :format')
            ->andWhere('l.statut = :actif')
            ->setParameter('pid', $periodeId)
            ->setParameter('format', FormatImport::F1)
            ->setParameter('actif', StatutLotImport::ACTIF)
            ->orderBy('l.importeLe', 'DESC')
            ->getQuery()
            ->getResult();

        foreach ($candidats as $lot) {
            $p = $lot->getParametres();
            if (($p['compte'] ?? null) === '1812-201'
                && ($p['etape'] ?? null) === 'ig_operation'
            ) {
                return $lot;
            }
        }

        return null;
    }

    private function resoudrePeriode(?int $periodeId): ?Periode
    {
        if ($periodeId !== null) {
            $p = $this->periodeRepository->find($periodeId);
            if ($p instanceof Periode) {
                return $p;
            }
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
     * @return list<string>
     */
    private function zeros(): array
    {
        return array_fill(0, 12, '0.00');
    }
}
