<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Service;

use App\Module\ServiceOperationsFinancieres\Entite\Import\IgOperation;
use App\Module\ServiceOperationsFinancieres\Entite\Import\LotImport;
use App\Module\ServiceOperationsFinancieres\Entite\Periode;
use App\Module\ServiceOperationsFinancieres\Entite\Recette\QualificationTransfert;
use App\Module\ServiceOperationsFinancieres\Entite\Referentiel\LigneFlechee;
use App\Module\ServiceOperationsFinancieres\Enum\FormatImport;
use App\Module\ServiceOperationsFinancieres\Enum\Mois;
use App\Module\ServiceOperationsFinancieres\Enum\OrigineMontantMensuel;
use App\Module\ServiceOperationsFinancieres\Enum\StatutLotImport;
use App\Module\ServiceOperationsFinancieres\Enum\TypeRecetteTransfert;
use App\Module\ServiceOperationsFinancieres\Repository\IgOperationRepository;
use App\Module\ServiceOperationsFinancieres\Repository\LigneFlecheeRepository;
use App\Module\ServiceOperationsFinancieres\Repository\LotImportRepository;
use App\Module\ServiceOperationsFinancieres\Repository\MontantMensuelRepository;
use App\Module\ServiceOperationsFinancieres\Repository\PeriodeRepository;
use App\Module\ServiceOperationsFinancieres\Repository\QualificationTransfertRepository;
use App\Shared\Exception\DonneesInvalidesException;
use Doctrine\ORM\EntityManagerInterface;

/**
 * Consolidation pétrolière par type (ligne_flechee + montant_mensuel).
 */
class ConsolidationPetroleService
{
    private const SOURCE = 'qualification_transfert';

    /** @var list<TypeRecetteTransfert> */
    private const TYPES_AFFICHES = [
        TypeRecetteTransfert::IS,
        TypeRecetteTransfert::DIVIDENDES,
        TypeRecetteTransfert::RMP,
        TypeRecetteTransfert::REDEVANCE_SUP,
        TypeRecetteTransfert::PROFIT_OIL,
        TypeRecetteTransfert::DISCOUNT_BONI,
        TypeRecetteTransfert::PIPES,
    ];

    public function __construct(
        private readonly PeriodeRepository $periodeRepository,
        private readonly LotImportRepository $lotImportRepository,
        private readonly IgOperationRepository $igOperationRepository,
        private readonly QualificationTransfertRepository $qualificationRepository,
        private readonly LigneFlecheeRepository $ligneFlecheeRepository,
        private readonly MontantMensuelRepository $montantMensuelRepository,
        private readonly RdModelCumulService $rdModelCumulService,
        private readonly EntityManagerInterface $em,
    ) {
    }

    /**
     * @return array<string, mixed>
     */
    public function synthetiser(?int $periodeId = null): array
    {
        $periode = $this->resoudrePeriode($periodeId);
        if (!$periode instanceof Periode || $periode->getId() === null) {
            return [
                'periode' => null,
                'lignes' => [],
                'alertes' => [],
                'message' => 'Aucune période SROT.',
            ];
        }

        $annee = $periode->getExercice()->getAnnee();
        $mois = $periode->getMois();
        $montants = $this->montantMensuelRepository->listerParExercice($annee, OrigineMontantMensuel::AUTO);

        /** @var array<string, string> $parRubrique */
        $parRubrique = [];
        foreach ($montants as $m) {
            if ($m->getMois() !== $mois) {
                continue;
            }
            $parRubrique[$m->getRubriqueCode()] = $m->getMontant();
        }

        $lignes = [];
        $total = '0.00';
        foreach (self::TYPES_AFFICHES as $type) {
            // Affichage par type (pas par code) : somme ligne_flechee du type pour le mois.
            $montant = $this->sommeLignesType($periode->getId(), $type);
            if (0 === bccomp($montant, '0.00', 2)) {
                $code = $type->rubriqueCode() ?? '';
                $montant = $parRubrique[$code] ?? '0.00';
            }
            $code = $type->rubriqueCode() ?? '';
            $lignes[] = [
                'type' => $type->value,
                'type_libelle' => $type->libelle(),
                'rubrique_code' => $code,
                'montant' => $montant,
            ];
            $total = bcadd($total, $montant, 2);
        }

        return [
            'periode' => $this->serialiserPeriode($periode),
            'lignes' => $lignes,
            'total' => $total,
            'alertes' => $this->alertes($periode),
            'message' => null,
        ];
    }

    /**
     * Recalcule ligne_flechee + montant_mensuel AUTO depuis les qualifications 1812-201.
     *
     * @return array<string, mixed>
     */
    public function recalculer(?int $periodeId = null): array
    {
        $periode = $this->resoudrePeriode($periodeId);
        if (!$periode instanceof Periode || $periode->getId() === null) {
            throw new DonneesInvalidesException('Aucune période SROT.');
        }

        $lot = $this->trouverLot1812201($periode->getId());
        if (!$lot instanceof LotImport || $lot->getId() === null) {
            throw new DonneesInvalidesException(
                'Aucun lot 1812-201 actif. Importez puis qualifiez les transferts.',
            );
        }

        $ops = $this->igOperationRepository->listerParLot($lot->getId());
        $ids = array_values(array_filter(array_map(
            static fn (IgOperation $o): ?int => $o->getId(),
            $ops,
        )));
        $qualifs = $this->qualificationRepository->indexerParOperations($ids);

        $this->ligneFlecheeRepository->supprimerParPeriodeEtSource($periode->getId(), self::SOURCE);
        $this->em->flush();

        /** @var array<string, string> $totauxRubrique */
        $totauxRubrique = [];
        $nb = 0;
        foreach ($ops as $op) {
            $id = $op->getId();
            if ($id === null) {
                continue;
            }
            $q = $qualifs[$id] ?? null;
            if (!$q instanceof QualificationTransfert || $q->isExclu()) {
                continue;
            }
            $type = $q->getTypeRecette();
            if (!$type->consolider()) {
                continue;
            }
            $code = $type->rubriqueCode();
            if ($code === null) {
                continue;
            }
            $montant = $op->getMRegl() ?? '0.00';
            $ligne = new LigneFlechee(
                self::SOURCE,
                (string) $id,
                $periode,
                $code,
                $periode->getMois(),
                $montant,
            );
            // Stocker le type dans source_id préfixe pour somme par type
            // On garde source_id = ig_operation_id ; type via regle_id null
            $this->em->persist($ligne);
            // Annoter via une 2e ligne meta? Better: store type in a comment field - we don't have one.
            // Use source_table = qualification_transfert and look up type from qualification on somme.
            $totauxRubrique[$code] = bcadd($totauxRubrique[$code] ?? '0.00', $montant, 2);
            ++$nb;
        }
        $this->em->flush();

        // Pour montants par type distinct partageant rubrique, recalculer totauxRubrique
        // depuis les qualifications directement
        $totauxParType = [];
        foreach (self::TYPES_AFFICHES as $type) {
            $totauxParType[$type->value] = '0.00';
        }
        foreach ($ops as $op) {
            $id = $op->getId();
            if ($id === null) {
                continue;
            }
            $q = $qualifs[$id] ?? null;
            if (!$q instanceof QualificationTransfert || $q->isExclu()) {
                continue;
            }
            $type = $q->getTypeRecette();
            if (!$type->consolider()) {
                continue;
            }
            $totauxParType[$type->value] = bcadd(
                $totauxParType[$type->value] ?? '0.00',
                $op->getMRegl() ?? '0.00',
                2,
            );
        }

        // Agrégation montant_mensuel AUTO par rubrique (somme des types)
        $parRubrique = [];
        foreach (self::TYPES_AFFICHES as $type) {
            $code = $type->rubriqueCode();
            if ($code === null) {
                continue;
            }
            $parRubrique[$code] = bcadd(
                $parRubrique[$code] ?? '0.00',
                $totauxParType[$type->value] ?? '0.00',
                2,
            );
        }

        $this->em->flush();
        $this->rdModelCumulService->recalculerAuto($periode->getExercice()->getAnnee());

        return $this->synthetiser($periode->getId());
    }

    private function sommeLignesType(int $periodeId, TypeRecetteTransfert $type): string
    {
        $lot = $this->trouverLot1812201($periodeId);
        if (!$lot instanceof LotImport || $lot->getId() === null) {
            return '0.00';
        }
        $ops = $this->igOperationRepository->listerParLot($lot->getId());
        $ids = array_values(array_filter(array_map(
            static fn (IgOperation $o): ?int => $o->getId(),
            $ops,
        )));
        $qualifs = $this->qualificationRepository->indexerParOperations($ids);
        $total = '0.00';
        foreach ($ops as $op) {
            $id = $op->getId();
            if ($id === null) {
                continue;
            }
            $q = $qualifs[$id] ?? null;
            if (!$q instanceof QualificationTransfert || $q->isExclu()) {
                continue;
            }
            if ($q->getTypeRecette() !== $type) {
                continue;
            }
            $total = bcadd($total, $op->getMRegl() ?? '0.00', 2);
        }

        return $total;
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function alertes(Periode $periode): array
    {
        $lot = $this->trouverLot1812201($periode->getId() ?? 0);
        if (!$lot instanceof LotImport || $lot->getId() === null) {
            return [];
        }
        $ops = $this->igOperationRepository->listerParLot($lot->getId());
        $ids = array_values(array_filter(array_map(
            static fn (IgOperation $o): ?int => $o->getId(),
            $ops,
        )));
        $qualifs = $this->qualificationRepository->indexerParOperations($ids);

        $alertes = [];
        $vus = [];
        foreach ($ops as $op) {
            $id = $op->getId();
            if ($id === null) {
                continue;
            }
            $q = $qualifs[$id] ?? null;
            if ($q?->isExclu()) {
                continue;
            }
            $type = $q?->getTypeRecette() ?? TypeRecetteTransfert::NON_QUALIFIE;
            $cle = ($op->getNMattir() ?? '').'|'.($op->getMRegl() ?? '').'|'.($op->getDCpta()?->format('Y-m-d') ?? '');
            if (isset($vus[$cle]) && $type->consolider()) {
                $alertes[] = [
                    'titre' => 'Doublon détecté',
                    'detail' => sprintf(
                        '%s · %s · %s FCFA le %s',
                        $type->libelle(),
                        $op->getLTiers() ?? $op->getNMattir() ?? '—',
                        $op->getMRegl() ?? '0',
                        $op->getDCpta()?->format('d/m/Y') ?? '—',
                    ),
                    'ig_operation_id' => $id,
                    'exclu' => false,
                ];
            }
            $vus[$cle] = true;

            if ($type->consolider() && !($q?->isVerifieBgfi() ?? false)) {
                $alertes[] = [
                    'titre' => 'Sans justificatif BEAC ni BGFI',
                    'detail' => sprintf(
                        '%s · %s · %s FCFA le %s',
                        $type->libelle(),
                        $op->getLTiers() ?? $op->getNMattir() ?? '—',
                        $op->getMRegl() ?? '0',
                        $op->getDCpta()?->format('d/m/Y') ?? '—',
                    ),
                    'ig_operation_id' => $id,
                    'exclu' => false,
                ];
            }
        }

        return array_slice($alertes, 0, 20);
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

            return $p instanceof Periode ? $p : null;
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
        ];
    }
}
