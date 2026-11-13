<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Service;

use App\Module\ServiceOperationsFinancieres\Entite\Import\AnomalieImport;
use App\Module\ServiceOperationsFinancieres\Entite\Import\LotImport;
use App\Module\ServiceOperationsFinancieres\Enum\Mois;
use App\Module\ServiceOperationsFinancieres\Enum\StatutLotImport;
use App\Module\ServiceOperationsFinancieres\Repository\AnomalieImportRepository;
use App\Module\ServiceOperationsFinancieres\Repository\LotImportRepository;
use App\Module\ServiceOperationsFinancieres\Service\Exception\RubriqueIntrouvableException;
use App\Shared\Entite\Utilisateur;
use App\Shared\Exception\DonneesInvalidesException;
use Doctrine\ORM\EntityManagerInterface;

/**
 * Historique des lots d'import (cadre commun).
 */
class LotImportService
{
    public function __construct(
        private readonly LotImportRepository $lotImportRepository,
        private readonly AnomalieImportRepository $anomalieImportRepository,
        private readonly EntityManagerInterface $em,
    ) {
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function lister(?int $periodeId = null, ?string $statut = null): array
    {
        $statutEnum = null;
        if ($statut !== null && $statut !== '' && strtolower($statut) !== 'tous') {
            $statutEnum = $this->parserStatut($statut);
        }

        return array_map(
            fn (LotImport $l): array => $this->serialiser($l),
            $this->lotImportRepository->lister($periodeId, $statutEnum),
        );
    }

    /**
     * @return array<string, mixed>
     */
    public function obtenir(int $id): array
    {
        return $this->serialiser($this->exiger($id), true);
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function listerAnomalies(int $lotId): array
    {
        $this->exiger($lotId);

        return array_map(
            static fn (AnomalieImport $a): array => [
                'id' => $a->getId(),
                'ligne' => $a->getLigne(),
                'colonne' => $a->getColonne(),
                'motif' => $a->getMotif(),
            ],
            $this->anomalieImportRepository->listerParLot($lotId),
        );
    }

    /**
     * @param array<string, mixed> $donnees
     *
     * @return array<string, mixed>
     */
    public function annuler(int $id, array $donnees, ?Utilisateur $acteur = null): array
    {
        $lot = $this->exiger($id);
        if ($lot->getStatut() !== StatutLotImport::ACTIF) {
            throw new DonneesInvalidesException('Seul un lot actif peut être annulé.');
        }

        $motif = trim((string) ($donnees['motif'] ?? ''));
        if ($motif === '') {
            throw new DonneesInvalidesException('Le motif d\'annulation est obligatoire.');
        }

        $lot->setStatut(StatutLotImport::ANNULE);
        $params = $lot->getParametres();
        $params['annulation'] = [
            'motif' => $motif,
            'par' => $acteur !== null
                ? trim($acteur->getPrenom().' '.$acteur->getNom())
                : null,
            'le' => (new \DateTimeImmutable())->format('c'),
        ];
        $lot->setParametres($params);
        $this->em->flush();

        return $this->serialiser($lot);
    }

    /**
     * Compare deux lots (même source / format).
     *
     * @param list<int> $ids
     *
     * @return array<string, mixed>
     */
    public function comparer(array $ids): array
    {
        if (count($ids) !== 2) {
            throw new DonneesInvalidesException('Sélectionnez exactement deux lots.');
        }

        $a = $this->exiger((int) $ids[0]);
        $b = $this->exiger((int) $ids[1]);

        if ($a->getFormat() !== $b->getFormat()) {
            throw new DonneesInvalidesException('Les deux lots doivent provenir de la même source (format).');
        }

        // Plus récent en premier
        if ($a->getImporteLe() < $b->getImporteLe()) {
            [$a, $b] = [$b, $a];
        }

        $deltaLignes = $a->getNbLignes() - $b->getNbLignes();
        $montantA = (float) $a->getMontantTotal();
        $montantB = (float) $b->getMontantTotal();
        $deltaMontant = $montantA - $montantB;
        $pct = $montantB != 0.0 ? ($deltaMontant / abs($montantB)) * 100 : null;

        $lignes = [
            sprintf('%s ↔ %s', $a->reference(), $b->reference()),
            sprintf(
                '%s%d lignes%s',
                $deltaLignes > 0 ? '+' : '',
                $deltaLignes,
                $pct !== null
                    ? sprintf(', %s%s %% sur le montant total', $pct > 0 ? '+' : '', number_format($pct, 1, ',', ' '))
                    : '',
            ),
        ];

        if ($deltaLignes !== 0) {
            $lignes[] = sprintf(
                '%d opération(s) présente(s) uniquement dans le lot le plus récent',
                abs($deltaLignes),
            );
        } else {
            $lignes[] = 'Aucun écart de lignes entre les deux lots.';
        }

        return [
            'lot_a' => $this->serialiser($a),
            'lot_b' => $this->serialiser($b),
            'delta_lignes' => $deltaLignes,
            'delta_montant' => number_format($deltaMontant, 2, '.', ''),
            'lignes' => $lignes,
        ];
    }

    private function exiger(int $id): LotImport
    {
        $lot = $this->lotImportRepository->find($id);
        if (!$lot instanceof LotImport) {
            throw new RubriqueIntrouvableException(sprintf('Lot #%d introuvable.', $id));
        }

        return $lot;
    }

    private function parserStatut(string $valeur): StatutLotImport
    {
        $normalise = strtoupper(str_replace([' ', '-'], '_', trim($valeur)));
        $alias = match ($normalise) {
            'ACTIF', 'ACTIVE' => 'ACTIF',
            'REMPLACE', 'REMPLACÉ', 'REMPLACEE', 'REMPLACÉE' => 'REMPLACE',
            'ANNULE', 'ANNULÉ', 'ANNULEE', 'ANNULÉE' => 'ANNULE',
            default => $normalise,
        };
        $statut = StatutLotImport::tryFrom($alias);
        if ($statut instanceof StatutLotImport) {
            return $statut;
        }

        throw new DonneesInvalidesException('Statut invalide (ACTIF, REMPLACE, ANNULE).');
    }

    /**
     * @return array<string, mixed>
     */
    private function serialiser(LotImport $l, bool $detail = false): array
    {
        $periode = $l->getPeriode();
        $mois = Mois::tryFrom($periode->getMois());
        $format = $l->getFormat();
        $statut = $l->getStatut();
        $user = $l->getImportePar();
        $params = $l->getParametres();

        $data = [
            'id' => $l->getId(),
            'reference' => $l->reference(),
            'periode_id' => $periode->getId(),
            'periode_libelle' => sprintf(
                '%s %d',
                $mois ? ucfirst($mois->libelle()) : (string) $periode->getMois(),
                $periode->getExercice()->getAnnee(),
            ),
            'format' => $format->value,
            'format_libelle' => $format->libelle(),
            'origine' => $format->origine(),
            'source' => (string) ($params['source_libelle'] ?? $format->libelle()),
            'parametres' => $params,
            'fichier_nom' => $l->getFichierNom(),
            'fichier_sha256' => $l->getFichierSha256(),
            'nb_lignes' => $l->getNbLignes(),
            'montant_total' => $l->getMontantTotal(),
            'statut' => $statut->value,
            'statut_libelle' => $statut->libelle(),
            'importe_par' => $user !== null
                ? trim($user->getPrenom().' '.$user->getNom())
                : null,
            'importe_par_id' => $user?->getId(),
            'importe_le' => $l->getImporteLe()->format('Y-m-d H:i:s'),
            'nb_anomalies' => $l->getAnomalies()->count(),
            'peut_annuler' => $statut === StatutLotImport::ACTIF,
        ];

        if ($detail) {
            $data['anomalies'] = array_map(
                static fn (AnomalieImport $a): array => [
                    'id' => $a->getId(),
                    'ligne' => $a->getLigne(),
                    'colonne' => $a->getColonne(),
                    'motif' => $a->getMotif(),
                ],
                $l->getAnomalies()->toArray(),
            );
        }

        return $data;
    }
}
