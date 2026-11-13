<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Service;

use App\Module\ServiceOperationsFinancieres\Entite\Import\LotImport;
use App\Module\ServiceOperationsFinancieres\Entite\Import\RecapBeac;
use App\Module\ServiceOperationsFinancieres\Entite\Periode;
use App\Module\ServiceOperationsFinancieres\Enum\FormatImport;
use App\Module\ServiceOperationsFinancieres\Enum\Mois;
use App\Module\ServiceOperationsFinancieres\Enum\StatutLotImport;
use App\Module\ServiceOperationsFinancieres\Repository\LotImportRepository;
use App\Module\ServiceOperationsFinancieres\Repository\PeriodeRepository;
use App\Module\ServiceOperationsFinancieres\Repository\RecapBeacRepository;
use App\Module\ServiceOperationsFinancieres\Repository\ScriptPoolSof;
use App\Shared\Entite\Utilisateur;
use App\Shared\Exception\DonneesInvalidesException;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\SecurityBundle\Security;

/**
 * Import F7 — récapitulatif des encaissements BEAC (table recap_beac).
 */
class RecapBeacService
{
    /** @var array<string, mixed> */
    private const PARAMETRES_LOTS = [
        'source' => 'ig-petrole',
        'source_libelle' => 'Comptes pétrole · Récapitulatif BEAC',
        'etape' => 'recap_beac',
    ];

    /** Codes pétroliers mis en avant (maquette). */
    private const CODES_PETROLE = ['RMP', 'RSU', 'PRO', 'ISP', 'DIV', 'BON'];

    public function __construct(
        private readonly ScriptPoolSof $scriptPoolSof,
        private readonly PeriodeRepository $periodeRepository,
        private readonly LotImportRepository $lotImportRepository,
        private readonly RecapBeacRepository $recapBeacRepository,
        private readonly LotImportService $lotImportService,
        private readonly EntityManagerInterface $em,
        private readonly Security $security,
        private readonly JournalAuditService $journalAuditService,
    ) {
    }

    /**
     * Lot ACTIF F7 de la période + lignes recap_beac.
     *
     * @return array<string, mixed>
     */
    public function obtenirActif(?int $periodeId = null): array
    {
        $periode = $this->resoudrePeriode($periodeId);
        if (!$periode instanceof Periode || $periode->getId() === null) {
            return [
                'periode' => null,
                'lot' => null,
                'lignes' => [],
                'nombre' => 0,
                'total' => '0.00',
                'message' => 'Aucune période ouverte. Ouvrez une période SROT avant d\'importer.',
            ];
        }

        $lot = $this->listerLotsActifsEtape($periode->getId())[0] ?? null;

        if (!$lot instanceof LotImport || $lot->getId() === null) {
            return [
                'periode' => $this->serialiserPeriode($periode),
                'lot' => null,
                'lignes' => [],
                'nombre' => 0,
                'total' => '0.00',
                'message' => 'Aucun récapitulatif BEAC actif pour cette période. Lancez une extraction.',
            ];
        }

        return $this->serialiserLotComplet($lot, $periode);
    }

    /**
     * Extrait Oracle (1er du mois → date) et enregistre un nouveau lot F7.
     *
     * @return array<string, mixed>
     */
    public function importer(string $dateDebut, string $dateFin, ?int $periodeId = null): array
    {
        [$debut, $fin] = $this->validerPeriode($dateDebut, $dateFin);
        if ((int) $debut->format('d') !== 1) {
            throw new DonneesInvalidesException(
                'La date de début doit être le 1er du mois (règle SROT / IG BEAC).',
            );
        }

        $periode = $this->resoudrePeriode($periodeId, $fin);
        if (!$periode instanceof Periode || $periode->getId() === null) {
            throw new DonneesInvalidesException(
                sprintf(
                    'Aucune période SROT pour %s %d. Créez la période avant d\'importer.',
                    Mois::tryFrom((int) $fin->format('n'))?->libelle() ?? $fin->format('m'),
                    (int) $fin->format('Y'),
                ),
            );
        }

        $dateDeb = $debut->format('d/m/Y');
        $dateFinFmt = $fin->format('d/m/Y');

        try {
            $brutes = $this->scriptPoolSof->extraireRecettesPetrolieresOpBeac($dateDeb, $dateFinFmt);
        } catch (\Throwable $e) {
            throw new DonneesInvalidesException(
                'Extraction IG BEAC impossible : '.$e->getMessage(),
            );
        }

        $lignes = [];
        $total = '0.00';
        foreach ($brutes as $ligne) {
            $normalisee = $this->normaliserLigne($ligne);
            if ($normalisee['code'] === '') {
                continue;
            }
            $lignes[] = $normalisee;
            $total = bcadd($total, $normalisee['montant'], 2);
        }

        $params = array_merge(self::PARAMETRES_LOTS, [
            'date_debut' => $debut->format('Y-m-d'),
            'date_fin' => $fin->format('Y-m-d'),
        ]);
        // Remplacer tous les lots ACTIF F7 / étape de la période
        $anciens = $this->listerLotsActifsEtape($periode->getId());
        $ancien = $anciens[0] ?? null;
        foreach ($anciens as $lotActif) {
            $lotActif->setStatut(StatutLotImport::REMPLACE);
        }
        if ($anciens !== []) {
            $this->em->flush();
        }

        $lot = new LotImport($periode, FormatImport::F7, $params);
        $lot->setNbLignes(count($lignes));
        $lot->setMontantTotal($total);
        $lot->setFichierNom(sprintf('recap_beac_%s_%s', $debut->format('Ymd'), $fin->format('Ymd')));
        $acteur = $this->acteur();
        if ($acteur instanceof Utilisateur) {
            $lot->setImportePar($acteur);
        }
        $this->em->persist($lot);
        $this->em->flush();

        foreach ($lignes as $l) {
            $this->em->persist(new RecapBeac($lot, $l['code'], $l['type_recette'], $l['montant']));
        }
        $this->em->flush();

        $this->journalAuditService->enregistrer(
            'IMPORTER',
            'recap_beac',
            (string) $lot->getId(),
            $acteur,
            $ancien instanceof LotImport ? ['lot_id' => $ancien->getId()] : null,
            [
                'lot_id' => $lot->getId(),
                'nb_lignes' => count($lignes),
                'montant_total' => $total,
                'date_debut' => $debut->format('Y-m-d'),
                'date_fin' => $fin->format('Y-m-d'),
            ],
        );

        return $this->serialiserLotComplet($lot, $periode, $debut, $fin);
    }

    /**
     * @return list<LotImport>
     */
    private function listerLotsActifsEtape(int $periodeId): array
    {
        /** @var list<LotImport> $candidats */
        $candidats = $this->lotImportRepository->createQueryBuilder('l')
            ->andWhere('l.periode = :periodeId')
            ->andWhere('l.format = :format')
            ->andWhere('l.statut = :actif')
            ->setParameter('periodeId', $periodeId)
            ->setParameter('format', FormatImport::F7)
            ->setParameter('actif', StatutLotImport::ACTIF)
            ->orderBy('l.importeLe', 'DESC')
            ->getQuery()
            ->getResult();

        $out = [];
        foreach ($candidats as $lot) {
            $p = $lot->getParametres();
            if (($p['source'] ?? null) === self::PARAMETRES_LOTS['source']
                && ($p['etape'] ?? null) === self::PARAMETRES_LOTS['etape']
            ) {
                $out[] = $lot;
            }
        }

        return $out;
    }

    /**
     * @return array<string, mixed>
     */
    private function serialiserLotComplet(
        LotImport $lot,
        Periode $periode,
        ?\DateTimeImmutable $debut = null,
        ?\DateTimeImmutable $fin = null,
    ): array {
        $lotId = $lot->getId() ?? 0;
        $entites = $this->recapBeacRepository->listerParLot($lotId);
        $lignes = [];
        $total = '0.00';
        foreach ($entites as $e) {
            $petrole = \in_array(strtoupper($e->getCode()), self::CODES_PETROLE, true);
            $lignes[] = [
                'id' => $e->getId(),
                'code' => $e->getCode(),
                'type_recette' => $e->getTypeRecette(),
                'montant' => $e->getMontant(),
                'petrole' => $petrole,
                'nature' => $petrole ? 'Pétrolière' : 'Hors pétrole',
            ];
            $total = bcadd($total, $e->getMontant(), 2);
        }

        $params = $lot->getParametres();

        return [
            'periode' => $this->serialiserPeriode($periode),
            'lot' => $this->lotImportService->obtenir($lotId),
            'date_debut' => $debut?->format('Y-m-d')
                ?? (isset($params['date_debut']) ? (string) $params['date_debut'] : null),
            'date_fin' => $fin?->format('Y-m-d')
                ?? (isset($params['date_fin']) ? (string) $params['date_fin'] : null),
            'lignes' => $lignes,
            'nombre' => count($lignes),
            'total' => $total,
            'message' => $lignes === []
                ? 'Aucune ligne BEAC pour cette période.'
                : null,
        ];
    }

    /**
     * @return array{code: string, type_recette: string, montant: string}
     */
    private function normaliserLigne(array $ligne): array
    {
        $code = $this->texte($this->cellule($ligne, 'CODE'));
        $type = $this->texte($this->cellule($ligne, 'TYPE_RECETTE'));
        $montant = $this->montant($this->cellule($ligne, 'MONTANT'));

        return [
            'code' => $code ?? '',
            'type_recette' => $type ?? '',
            'montant' => $montant,
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
