<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Service;

use App\Module\ServiceOperationsFinancieres\Entite\Extraction\ExtractionElement;
use App\Module\ServiceOperationsFinancieres\Entite\Extraction\ExtractionLancement;
use App\Module\ServiceOperationsFinancieres\Entite\Import\LotImport;
use App\Module\ServiceOperationsFinancieres\Entite\Periode;
use App\Module\ServiceOperationsFinancieres\Enum\StatutLotImport;
use App\Module\ServiceOperationsFinancieres\Extraction\ExtractionDefinition;
use App\Module\ServiceOperationsFinancieres\Extraction\ExtractionRegistry;
use App\Module\ServiceOperationsFinancieres\Repository\ExtractionLancementRepository;
use App\Module\ServiceOperationsFinancieres\Repository\LotImportRepository;
use App\Module\ServiceOperationsFinancieres\Repository\PeriodeRepository;
use App\Shared\Entite\Utilisateur;
use App\Shared\Exception\DonneesInvalidesException;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\SecurityBundle\Security;

/**
 * Orchestration page « Extractions DC / IG » (lancement + progression).
 */
class ExtractionOrchestrateurService
{
    public function __construct(
        private readonly ExtractionRegistry $registry,
        private readonly PeriodeRepository $periodeRepository,
        private readonly LotImportRepository $lotImportRepository,
        private readonly ExtractionLancementRepository $lancementRepository,
        private readonly EntityManagerInterface $em,
        private readonly Security $security,
        private readonly IgCreditsDeleguesService $igCreditsDeleguesService,
        private readonly IgAvancesBudgetService $igAvancesBudgetService,
        private readonly IgReglementsTvaService $igReglementsTvaService,
        private readonly IgOperationDouanesService $igOperationDouanesService,
        private readonly IgOperationPetroleService $igOperationPetroleService,
        private readonly RecapBeacService $recapBeacService,
        private readonly DcReglementsOrdonnancesService $dcReglementsOrdonnancesService,
        private readonly DcReglementsTvaService $dcReglementsTvaService,
    ) {
    }

    /**
     * @return array<string, mixed>
     */
    public function definitions(): array
    {
        return [
            'familles' => $this->registry->familles(),
            'presets' => array_map(
                static fn (ExtractionDefinition $d): array => $d->serialiser(),
                $this->registry->toutes(),
            ),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function statuts(?int $periodeId, ?string $dateSituation = null): array
    {
        $periode = $this->resoudrePeriode($periodeId);
        $pid = $periode?->getId();
        $lots = $pid !== null ? $this->lotImportRepository->lister($pid) : [];

        $parSource = [];
        foreach ($lots as $lot) {
            $src = (string) ($lot->getParametres()['source'] ?? '');
            if ($src === '') {
                continue;
            }
            if (!isset($parSource[$src]) || $lot->getImporteLe() > $parSource[$src]->getImporteLe()) {
                $parSource[$src] = $lot;
            }
        }

        $exercice = $periode?->getExercice()->getAnnee() ?? (int) date('Y');
        $situation = null;
        if (is_string($dateSituation) && $dateSituation !== '') {
            $situation = new \DateTimeImmutable($dateSituation);
        }
        if (!$situation instanceof \DateTimeImmutable) {
            $situation = $periode?->getDateSituation();
        }
        if (!$situation instanceof \DateTimeImmutable) {
            if ($periode instanceof Periode) {
                $situation = (new \DateTimeImmutable(
                    sprintf('%d-%02d-01', $exercice, $periode->getMois()),
                ))->modify('last day of this month');
                $aujourdhui = new \DateTimeImmutable('today');
                if ($situation > $aujourdhui) {
                    $situation = $aujourdhui;
                }
            } else {
                $situation = new \DateTimeImmutable('today');
            }
        }

        $presets = [];
        foreach ($this->registry->toutes() as $def) {
            $periodeCalc = $def->periode->calculer($exercice, $situation);
            $srcLot = $def->sourceLot ?? $def->code;
            $lot = $this->trouverLotSource($parSource, $srcLot);
            $statut = 'a_extraire';
            if (!$def->disponible) {
                $statut = $def->depotExcelUniquement ? 'excel' : 'indisponible';
            } elseif ($lot instanceof LotImport && $lot->getStatut() === StatutLotImport::ACTIF && $lot->getNbLignes() > 0) {
                $statut = 'a_jour';
            }

            $presets[] = [
                'code' => $def->code,
                'statut' => $statut,
                'periode_calculee' => $periodeCalc,
                'dernier_lot' => $lot instanceof LotImport ? [
                    'id' => $lot->getId(),
                    'importe_le' => $lot->getImporteLe()->format('Y-m-d H:i'),
                    'nb_lignes' => $lot->getNbLignes(),
                    'montant_total' => $lot->getMontantTotal(),
                    'statut' => $lot->getStatut()->value,
                ] : null,
            ];
        }

        $lancementEnCours = $pid !== null
            ? $this->lancementRepository->trouverEnCours($pid)
            : null;

        return [
            'periode_id' => $pid,
            'exercice' => $exercice,
            'date_situation' => $situation->format('Y-m-d'),
            'presets' => $presets,
            'lancement_en_cours_id' => $lancementEnCours?->getId(),
        ];
    }

    /**
     * @param list<string>                             $codes
     * @param array<string, array<string, mixed>>|null $surcharges
     *
     * @return array<string, mixed>
     */
    public function creerLancement(
        int $periodeId,
        array $codes,
        ?string $dateSituation = null,
        ?array $surcharges = null,
    ): array {
        $periode = $this->periodeRepository->find($periodeId);
        if (!$periode instanceof Periode) {
            throw new DonneesInvalidesException(sprintf('Période #%d introuvable.', $periodeId));
        }

        $existant = $this->lancementRepository->trouverEnCours($periodeId);
        if ($existant instanceof ExtractionLancement) {
            return $this->serialiserLancement($existant);
        }

        $exercice = $periode->getExercice()->getAnnee();
        $situation = $dateSituation
            ? new \DateTimeImmutable($dateSituation)
            : ($periode->getDateSituation() ?? new \DateTimeImmutable('today'));

        $surchargesNorm = $this->normaliserSurcharges($surcharges, $codes, $exercice, $situation);

        $user = $this->security->getUser();
        $lancePar = $user instanceof Utilisateur ? $user : null;

        $lancement = new ExtractionLancement($periode, $exercice, $situation, $lancePar, $surchargesNorm);
        $ordre = 0;

        $prep = new ExtractionElement(
            sprintf(
                'Préparation des paramètres — exercice %d, situation au %s, %d extraction(s)',
                $exercice,
                $situation->format('d/m/Y'),
                count($codes),
            ),
            $ordre++,
        );
        $prep->setStatut(ExtractionElement::TERMINE);
        $prep->setPourcentage(100);
        $prep->setDebut(new \DateTimeImmutable());
        $prep->setFin(new \DateTimeImmutable());
        $lancement->ajouterElement($prep);

        $ordreCodes = $this->registry->ordreExtraireTout();
        usort($codes, static function (string $a, string $b) use ($ordreCodes): int {
            $ia = array_search($a, $ordreCodes, true);
            $ib = array_search($b, $ordreCodes, true);
            $ia = $ia === false ? 999 : $ia;
            $ib = $ib === false ? 999 : $ib;

            return $ia <=> $ib;
        });

        foreach ($codes as $code) {
            $def = $this->registry->trouver($code);
            if (!$def instanceof ExtractionDefinition) {
                continue;
            }
            $sur = $surchargesNorm[$code] ?? [];
            $debut = is_string($sur['date_debut'] ?? null) ? $sur['date_debut'] : null;
            $fin = is_string($sur['date_fin'] ?? null) ? $sur['date_fin'] : null;
            $titre = $def->libelle;
            if ($debut && $fin) {
                $titre .= sprintf(
                    ' — %s → %s',
                    $this->isoVersFr($debut),
                    $this->isoVersFr($fin),
                );
            }
            $el = new ExtractionElement($titre, $ordre++);
            $el->setCodePreset($def->code);
            if (!$def->disponible) {
                $el->setStatut(ExtractionElement::IGNORE);
                $el->setMessage($def->motifIndisponible !== '' ? $def->motifIndisponible : 'non disponible');
                $el->setPourcentage(100);
            }
            $lancement->ajouterElement($el);
        }

        $fin = new ExtractionElement('Finalisation', $ordre);
        $lancement->ajouterElement($fin);

        $this->em->persist($lancement);
        $this->em->flush();

        return $this->serialiserLancement($lancement);
    }

    /**
     * Traite le prochain élément en attente (appelé par le poll frontend).
     *
     * @return array<string, mixed>
     */
    public function avancer(int $lancementId): array
    {
        $lancement = $this->lancementRepository->find($lancementId);
        if (!$lancement instanceof ExtractionLancement) {
            throw new DonneesInvalidesException(sprintf('Lancement #%d introuvable.', $lancementId));
        }
        if ($lancement->getStatut() !== ExtractionLancement::EN_COURS) {
            return $this->serialiserLancement($lancement);
        }

        $suivant = null;
        foreach ($lancement->getElements() as $el) {
            if ($el->getParent() !== null) {
                continue;
            }
            if ($el->getStatut() === ExtractionElement::EN_ATTENTE) {
                $suivant = $el;
                break;
            }
        }

        if (!$suivant instanceof ExtractionElement) {
            $lancement->setStatut(ExtractionLancement::TERMINE);
            $lancement->setPourcentage(100);
            $lancement->setFin(new \DateTimeImmutable());
            foreach ($lancement->getElements() as $el) {
                if ($el->getTitre() === 'Finalisation' && $el->getStatut() === ExtractionElement::EN_ATTENTE) {
                    $nbLots = 0;
                    foreach ($lancement->getElements() as $e) {
                        if ($e->getLot() !== null) {
                            ++$nbLots;
                        }
                    }
                    $el->setStatut(ExtractionElement::TERMINE);
                    $el->setMessage(sprintf('%d lot(s) créé(s) ou remplacé(s)', $nbLots));
                    $el->setPourcentage(100);
                    $el->setFin(new \DateTimeImmutable());
                }
            }
            $this->em->flush();

            return $this->serialiserLancement($lancement);
        }

        if ($suivant->getTitre() === 'Finalisation') {
            $suivant->setStatut(ExtractionElement::TERMINE);
            $suivant->setPourcentage(100);
            $suivant->setFin(new \DateTimeImmutable());
            $lancement->setStatut(ExtractionLancement::TERMINE);
            $lancement->setPourcentage(100);
            $lancement->setFin(new \DateTimeImmutable());
            $this->recalculerPourcentage($lancement);
            $this->em->flush();

            return $this->serialiserLancement($lancement);
        }

        $suivant->setStatut(ExtractionElement::EN_COURS);
        $suivant->setDebut(new \DateTimeImmutable());
        $suivant->setPourcentage(5);
        $this->em->flush();

        $code = $suivant->getCodePreset();
        try {
            if ($code === null) {
                $suivant->setStatut(ExtractionElement::TERMINE);
                $suivant->setPourcentage(100);
            } else {
                $resultat = $this->executerPreset(
                    $code,
                    $lancement->getPeriode()->getId() ?? 0,
                    $lancement->getDateSituation(),
                    $lancement->getSurcharge($code),
                );
                $suivant->setStatut(ExtractionElement::TERMINE);
                $suivant->setLignesTraitees($resultat['nb_lignes'] ?? 0);
                $suivant->setPourcentage(100);
                $suivant->setMessage(sprintf('%d lignes', $resultat['nb_lignes'] ?? 0));
                if (isset($resultat['lot']) && $resultat['lot'] instanceof LotImport) {
                    $suivant->setLot($resultat['lot']);
                }
            }
        } catch (\Throwable $e) {
            $suivant->setStatut(ExtractionElement::ERREUR);
            $suivant->setMessage(mb_substr($e->getMessage(), 0, 500));
            $suivant->setPourcentage(100);
        }
        $suivant->setFin(new \DateTimeImmutable());
        $this->recalculerPourcentage($lancement);
        $this->em->flush();

        return $this->serialiserLancement($lancement);
    }

    /**
     * @return array<string, mixed>
     */
    public function obtenirLancement(int $id): array
    {
        $lancement = $this->lancementRepository->find($id);
        if (!$lancement instanceof ExtractionLancement) {
            throw new DonneesInvalidesException(sprintf('Lancement #%d introuvable.', $id));
        }

        return $this->serialiserLancement($lancement);
    }

    /**
     * @return array<string, mixed>
     */
    public function annuler(int $id): array
    {
        $lancement = $this->lancementRepository->find($id);
        if (!$lancement instanceof ExtractionLancement) {
            throw new DonneesInvalidesException(sprintf('Lancement #%d introuvable.', $id));
        }
        $lancement->setStatut(ExtractionLancement::ANNULE);
        $lancement->setFin(new \DateTimeImmutable());
        foreach ($lancement->getElements() as $el) {
            if (in_array($el->getStatut(), [ExtractionElement::EN_ATTENTE, ExtractionElement::EN_COURS], true)) {
                $el->setStatut(ExtractionElement::ANNULE);
                $el->setMessage('annulé');
                $el->setFin(new \DateTimeImmutable());
            }
        }
        $this->em->flush();

        return $this->serialiserLancement($lancement);
    }

    /**
     * @param array<string, mixed> $surcharge
     *
     * @return array{nb_lignes: int, lot?: LotImport}
     */
    private function executerPreset(
        string $code,
        int $periodeId,
        \DateTimeImmutable $situation,
        array $surcharge = [],
    ): array {
        $def = $this->registry->trouver($code);
        if (!$def instanceof ExtractionDefinition) {
            throw new DonneesInvalidesException(sprintf('Preset inconnu : %s', $code));
        }
        if (!$def->disponible) {
            throw new DonneesInvalidesException($def->motifIndisponible ?: 'Preset non disponible.');
        }

        $periode = $this->periodeRepository->find($periodeId);
        $exercice = $periode instanceof Periode ? $periode->getExercice()->getAnnee() : (int) $situation->format('Y');
        $periodeCalc = $def->periode->calculer($exercice, $situation);

        $debut = is_string($surcharge['date_debut'] ?? null) && $surcharge['date_debut'] !== ''
            ? (string) $surcharge['date_debut']
            : ($periodeCalc['debut'] ?? $situation->format('Y-m-d'));
        $fin = is_string($surcharge['date_fin'] ?? null) && $surcharge['date_fin'] !== ''
            ? (string) $surcharge['date_fin']
            : ($periodeCalc['fin'] ?? $situation->format('Y-m-d'));
        if ($debut === '' || $fin === '') {
            throw new DonneesInvalidesException(
                sprintf('Dates début/fin requises pour « %s ».', $def->libelle),
            );
        }
        $dDebut = $this->isoVersFr($debut);
        $dFin = $this->isoVersFr($fin);

        $res = match ($code) {
            'ig-cdel-4742' => $this->igCreditsDeleguesService->importerOracle($dDebut, $dFin, $periodeId),
            'ig-avances-etat' => $this->igAvancesBudgetService->importerOracle(
                $dDebut,
                $dFin,
                $periodeId,
                IgAvancesBudgetService::COMPTE_ETAT,
            ),
            'ig-avances-postes' => $this->igAvancesBudgetService->importerOracle(
                $dDebut,
                $dFin,
                $periodeId,
                IgAvancesBudgetService::COMPTE_POSTE,
            ),
            'ig-tva' => $this->igReglementsTvaService->importerOracle($dDebut, $dFin, $periodeId),
            'ig-douanes', 'ig-rusid' => $this->igOperationDouanesService->importer($dDebut, $dFin, $periodeId),
            'ig-petrole-1812-201', 'ig-petrole-comptes' => $this->igOperationPetroleService->importer(
                $dDebut,
                $dFin,
                $periodeId,
            ),
            'ig-beac' => $this->recapBeacService->importer($dDebut, $dFin, $periodeId),
            'dc-xrgv' => $this->dcReglementsOrdonnancesService->importerOracle($dDebut, $dFin, $periodeId),
            'dc-xrgm-tva' => $this->dcReglementsTvaService->importerOracle(
                $dDebut,
                $dFin,
                $periodeId,
                \App\Module\ServiceOperationsFinancieres\Enum\TypeDcMandat::REGLE,
            ),
            'dc-xram-tva' => $this->dcReglementsTvaService->importerOracle(
                $dDebut,
                $dFin,
                $periodeId,
                \App\Module\ServiceOperationsFinancieres\Enum\TypeDcMandat::RAP,
            ),
            default => throw new DonneesInvalidesException(
                sprintf('Exécution unifiée non encore branchée pour « %s » — utilisez la page dédiée ou le dépôt Excel.', $def->libelle),
            ),
        };

        $nb = (int) ($res['nb_lignes'] ?? $res['lot']['nb_lignes'] ?? 0);
        if ($nb === 0 && isset($res['comptes']) && is_array($res['comptes'])) {
            $nb = (int) array_sum(array_column($res['comptes'], 'nb_lignes'));
        }
        if ($nb === 0 && isset($res['feuilles']) && is_array($res['feuilles'])) {
            $nb = (int) array_sum(array_column($res['feuilles'], 'nb_lignes'));
        }
        $lotId = $res['lot']['id'] ?? $res['lot_id'] ?? null;
        if (!is_int($lotId) && isset($res['feuilles'][0]['lot_id']) && is_numeric($res['feuilles'][0]['lot_id'])) {
            $lotId = (int) $res['feuilles'][0]['lot_id'];
        }
        if (!is_int($lotId) && isset($res['comptes'][0]['lot_id']) && is_numeric($res['comptes'][0]['lot_id'])) {
            $lotId = (int) $res['comptes'][0]['lot_id'];
        }
        $lot = is_int($lotId) ? $this->lotImportRepository->find($lotId) : null;

        return [
            'nb_lignes' => $nb,
            'lot' => $lot instanceof LotImport ? $lot : null,
        ];
    }

    private function isoVersFr(string $iso): string
    {
        $d = \DateTimeImmutable::createFromFormat('Y-m-d', $iso);
        if (!$d) {
            return $iso;
        }

        return $d->format('d/m/Y');
    }

    /**
     * Complète les surcharges avec la période calculée par défaut si dates absentes.
     *
     * @param array<string, array<string, mixed>>|null $surcharges
     * @param list<string>                             $codes
     *
     * @return array<string, array<string, mixed>>
     */
    private function normaliserSurcharges(
        ?array $surcharges,
        array $codes,
        int $exercice,
        \DateTimeImmutable $situation,
    ): array {
        $out = [];
        foreach ($codes as $code) {
            $def = $this->registry->trouver($code);
            if (!$def instanceof ExtractionDefinition) {
                continue;
            }
            $brut = is_array($surcharges[$code] ?? null) ? $surcharges[$code] : [];
            $calc = $def->periode->calculer($exercice, $situation);
            $debut = is_string($brut['date_debut'] ?? null) && $brut['date_debut'] !== ''
                ? (string) $brut['date_debut']
                : ($calc['debut'] ?? null);
            $fin = is_string($brut['date_fin'] ?? null) && $brut['date_fin'] !== ''
                ? (string) $brut['date_fin']
                : ($calc['fin'] ?? null);
            $out[$code] = array_filter([
                'date_debut' => $debut,
                'date_fin' => $fin,
            ], static fn ($v) => $v !== null && $v !== '');
        }

        return $out;
    }

    private function recalculerPourcentage(ExtractionLancement $lancement): void
    {
        $tops = [];
        foreach ($lancement->getElements() as $el) {
            if ($el->getParent() === null) {
                $tops[] = $el;
            }
        }
        $n = count($tops);
        if ($n === 0) {
            return;
        }
        $done = 0;
        foreach ($tops as $el) {
            if (in_array($el->getStatut(), [
                ExtractionElement::TERMINE,
                ExtractionElement::ERREUR,
                ExtractionElement::IGNORE,
                ExtractionElement::ANNULE,
            ], true)) {
                ++$done;
            } elseif ($el->getStatut() === ExtractionElement::EN_COURS) {
                $done += $el->getPourcentage() / 100;
            }
        }
        $lancement->setPourcentage((int) floor(($done / $n) * 100));
    }

    /**
     * @param array<string, LotImport> $parSource
     */
    private function trouverLotSource(array $parSource, string $srcLot): ?LotImport
    {
        if (isset($parSource[$srcLot])) {
            return $parSource[$srcLot];
        }
        foreach ($parSource as $src => $lot) {
            if ($src === $srcLot || str_starts_with($src, $srcLot.'-') || str_starts_with($src, $srcLot.'_')) {
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
        $courant = null;
        foreach ($this->periodeRepository->findBy([], ['id' => 'DESC'], 20) as $p) {
            if ($p instanceof Periode) {
                $courant = $p;
                break;
            }
        }

        return $courant;
    }

    /**
     * @return array<string, mixed>
     */
    private function serialiserLancement(ExtractionLancement $l): array
    {
        $elements = [];
        foreach ($l->getElements() as $el) {
            $elements[] = [
                'id' => $el->getId(),
                'parent_id' => $el->getParent()?->getId(),
                'ordre' => $el->getOrdre(),
                'code_preset' => $el->getCodePreset(),
                'compte' => $el->getCompte(),
                'nature' => $el->getNature(),
                'titre' => $el->getTitre(),
                'statut' => $el->getStatut(),
                'lignes_traitees' => $el->getLignesTraitees(),
                'lignes_a_extraire' => $el->getLignesAExtraire(),
                'pourcentage' => $el->getPourcentage(),
                'message' => $el->getMessage(),
                'lot_id' => $el->getLot()?->getId(),
            ];
        }

        $ecoule = (new \DateTimeImmutable())->getTimestamp() - $l->getDebut()->getTimestamp();

        return [
            'id' => $l->getId(),
            'periode_id' => $l->getPeriode()->getId(),
            'exercice' => $l->getExercice(),
            'date_situation' => $l->getDateSituation()->format('Y-m-d'),
            'statut' => $l->getStatut(),
            'pourcentage' => $l->getPourcentage(),
            'debut' => $l->getDebut()->format(\DateTimeInterface::ATOM),
            'fin' => $l->getFin()?->format(\DateTimeInterface::ATOM),
            'temps_ecoule_s' => $ecoule,
            'elements' => $elements,
        ];
    }
}
