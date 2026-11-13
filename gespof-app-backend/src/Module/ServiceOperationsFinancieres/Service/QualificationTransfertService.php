<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Service;

use App\Module\ServiceOperationsFinancieres\Entite\Import\IgOperation;
use App\Module\ServiceOperationsFinancieres\Entite\Import\LotImport;
use App\Module\ServiceOperationsFinancieres\Entite\Periode;
use App\Module\ServiceOperationsFinancieres\Entite\Recette\QualificationTransfert;
use App\Module\ServiceOperationsFinancieres\Enum\FormatImport;
use App\Module\ServiceOperationsFinancieres\Enum\Mois;
use App\Module\ServiceOperationsFinancieres\Enum\StatutLotImport;
use App\Module\ServiceOperationsFinancieres\Enum\TypeRecetteTransfert;
use App\Module\ServiceOperationsFinancieres\Repository\IgOperationRepository;
use App\Module\ServiceOperationsFinancieres\Repository\LotImportRepository;
use App\Module\ServiceOperationsFinancieres\Repository\PeriodeRepository;
use App\Module\ServiceOperationsFinancieres\Repository\QualificationTransfertRepository;
use App\Module\ServiceOperationsFinancieres\Repository\SocietePetroliereRepository;
use App\Shared\Entite\Utilisateur;
use App\Shared\Exception\DonneesInvalidesException;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\SecurityBundle\Security;

/**
 * Qualification des transferts 1812-201 (Recettes › Pétrolières).
 */
class QualificationTransfertService
{
    public function __construct(
        private readonly PeriodeRepository $periodeRepository,
        private readonly LotImportRepository $lotImportRepository,
        private readonly IgOperationRepository $igOperationRepository,
        private readonly QualificationTransfertRepository $qualificationRepository,
        private readonly SocietePetroliereRepository $societeRepository,
        private readonly EntityManagerInterface $em,
        private readonly Security $security,
    ) {
    }

    /**
     * @return array<string, mixed>
     */
    public function lister(?int $periodeId = null, bool $afficherNa = false): array
    {
        $periode = $this->resoudrePeriode($periodeId);
        if (!$periode instanceof Periode || $periode->getId() === null) {
            return [
                'periode' => null,
                'lot' => null,
                'lignes' => [],
                'kpis' => ['operations' => 0, 'non_qualifiees' => 0, 'verifiees_bgfi' => 0],
                'types' => $this->typesDisponibles(),
                'message' => 'Aucune période SROT.',
            ];
        }

        $lot = $this->trouverLot1812201($periode->getId());
        if (!$lot instanceof LotImport || $lot->getId() === null) {
            return [
                'periode' => $this->serialiserPeriode($periode),
                'lot' => null,
                'lignes' => [],
                'kpis' => ['operations' => 0, 'non_qualifiees' => 0, 'verifiees_bgfi' => 0],
                'types' => $this->typesDisponibles(),
                'message' => 'Aucun lot F1 actif pour 1812-201. Importez d\'abord Extractions IG › Comptes pétrole.',
            ];
        }

        $ops = $this->igOperationRepository->listerParLot($lot->getId());
        $ids = array_values(array_filter(array_map(
            static fn (IgOperation $o): ?int => $o->getId(),
            $ops,
        )));
        $qualifs = $this->qualificationRepository->indexerParOperations($ids);

        $lignes = [];
        $nonQual = 0;
        $bgfi = 0;
        foreach ($ops as $op) {
            $id = $op->getId();
            if ($id === null) {
                continue;
            }
            $q = $qualifs[$id] ?? null;
            $type = $q?->getTypeRecette() ?? TypeRecetteTransfert::NON_QUALIFIE;
            if (!$afficherNa && $type === TypeRecetteTransfert::NA) {
                continue;
            }
            if ($type === TypeRecetteTransfert::NON_QUALIFIE) {
                ++$nonQual;
            }
            if ($q?->isVerifieBgfi()) {
                ++$bgfi;
            }

            $matricule = $q?->getSocieteMatricule() ?? $op->getNMattir();
            $societe = $matricule !== null
                ? $this->societeRepository->trouverParMatricule($matricule)
                : null;

            $lignes[] = [
                'ig_operation_id' => $id,
                'd_cpta' => $op->getDCpta()?->format('Y-m-d'),
                'n_regl' => $op->getNRegl(),
                'n_mattir' => $op->getNMattir(),
                'societe_matricule' => $matricule,
                'societe_nom' => $societe?->getNom() ?? $op->getLTiers(),
                'montant' => $op->getMRegl() ?? '0.00',
                'mode' => $this->libelleMode($op->getCNop()),
                'c_nop' => $op->getCNop(),
                'type_recette' => $type->value,
                'type_recette_libelle' => $type->libelle(),
                'verifie_bgfi' => $q?->isVerifieBgfi() ?? false,
                'exclu' => $q?->isExclu() ?? false,
                'motif' => $q?->getMotif(),
                'par' => $q?->getPar(),
                'le' => $q?->getLe()?->format(\DateTimeInterface::ATOM),
            ];
        }

        return [
            'periode' => $this->serialiserPeriode($periode),
            'lot' => [
                'id' => $lot->getId(),
                'reference' => $lot->reference(),
                'nb_lignes' => $lot->getNbLignes(),
                'montant_total' => $lot->getMontantTotal(),
            ],
            'lignes' => $lignes,
            'kpis' => [
                'operations' => count($lignes),
                'non_qualifiees' => $nonQual,
                'verifiees_bgfi' => $bgfi,
            ],
            'types' => $this->typesDisponibles(),
            'message' => null,
        ];
    }

    /**
     * @param array<string, mixed> $donnees
     *
     * @return array<string, mixed>
     */
    public function enregistrer(int $igOperationId, array $donnees): array
    {
        $op = $this->igOperationRepository->find($igOperationId);
        if (!$op instanceof IgOperation) {
            throw new DonneesInvalidesException(sprintf('Opération #%d introuvable.', $igOperationId));
        }

        $q = $this->qualificationRepository->trouverParOperation($igOperationId);
        if (!$q instanceof QualificationTransfert) {
            $q = new QualificationTransfert($op);
            $this->em->persist($q);
        }

        if (array_key_exists('type_recette', $donnees)) {
            $q->setTypeRecette($this->parserType((string) $donnees['type_recette']));
        }
        if (array_key_exists('societe_matricule', $donnees)) {
            $mat = trim((string) ($donnees['societe_matricule'] ?? ''));
            $q->setSocieteMatricule($mat !== '' ? $mat : null);
        }
        if (array_key_exists('verifie_bgfi', $donnees)) {
            $q->setVerifieBgfi($this->parserBool($donnees['verifie_bgfi']));
        }
        if (array_key_exists('exclu', $donnees)) {
            $q->setExclu($this->parserBool($donnees['exclu']));
        }
        if (array_key_exists('motif', $donnees)) {
            $motif = trim((string) ($donnees['motif'] ?? ''));
            $q->setMotif($motif !== '' ? $motif : null);
        }

        $acteur = $this->acteur();
        $q->setPar($acteur !== null ? trim($acteur->getPrenom().' '.$acteur->getNom()) : null);
        $q->setLe(new \DateTimeImmutable());

        $this->em->flush();

        return [
            'ig_operation_id' => $igOperationId,
            'type_recette' => $q->getTypeRecette()->value,
            'type_recette_libelle' => $q->getTypeRecette()->libelle(),
            'societe_matricule' => $q->getSocieteMatricule(),
            'verifie_bgfi' => $q->isVerifieBgfi(),
            'exclu' => $q->isExclu(),
            'motif' => $q->getMotif(),
            'par' => $q->getPar(),
            'le' => $q->getLe()?->format(\DateTimeInterface::ATOM),
        ];
    }

    /**
     * @return list<array{valeur: string, libelle: string}>
     */
    private function typesDisponibles(): array
    {
        return array_map(
            static fn (TypeRecetteTransfert $t): array => [
                'valeur' => $t->value,
                'libelle' => $t->libelle(),
            ],
            TypeRecetteTransfert::cases(),
        );
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

    private function parserType(string $valeur): TypeRecetteTransfert
    {
        $normalise = strtoupper(str_replace([' ', '-'], '_', trim($valeur)));
        $alias = match ($normalise) {
            'NA', 'N/A', 'N_A' => 'N/A',
            'NON_QUALIFIE', 'NONQUALIFIE', 'NON_QUALIFIÉ' => 'NON_QUALIFIE',
            'DIVIDENDE' => 'DIVIDENDES',
            'PROFIT_OIL', 'PROFIT_OIL', 'PRO' => 'PROFIT_OIL',
            'REDEVANCE_SUPERFICIAIRE', 'REDEVANCE_SUP', 'RSU' => 'REDEVANCE_SUP',
            'DISCOUNT', 'DISCOUNT_ET_BONI', 'DISCOUNT_BONI', 'BON' => 'DISCOUNT_BONI',
            'ISP' => 'IS',
            default => $normalise,
        };
        $t = TypeRecetteTransfert::tryFrom($alias);
        if ($t instanceof TypeRecetteTransfert) {
            return $t;
        }

        throw new DonneesInvalidesException('Type de recette invalide.');
    }

    private function parserBool(mixed $valeur): bool
    {
        if (is_bool($valeur)) {
            return $valeur;
        }
        $s = strtolower(trim((string) $valeur));

        return in_array($s, ['1', 'true', 'oui', 'yes', 'o'], true);
    }

    private function libelleMode(?string $nop): string
    {
        return match ($nop) {
            'B' => 'Bancaire',
            'N' => 'Numéraire',
            default => $nop ?? '—',
        };
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

    private function acteur(): ?Utilisateur
    {
        $u = $this->security->getUser();

        return $u instanceof Utilisateur ? $u : null;
    }
}
