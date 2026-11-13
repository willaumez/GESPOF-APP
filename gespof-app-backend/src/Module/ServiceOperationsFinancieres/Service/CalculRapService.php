<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Service;

use App\Module\ServiceOperationsFinancieres\Repository\ExclusionRapRepository;
use App\Module\ServiceOperationsFinancieres\Support\CalculRapFiltres;
use App\Module\ServiceOperationsFinancieres\Support\ClassementCreditDelegue;

/**
 * Application des exclusions RAP (Lot 1 — règles fixes + table sof_exclusion_rap).
 */
class CalculRapService
{
    public function __construct(
        private readonly ExclusionRapRepository $exclusionRapRepository,
    ) {
    }

    /**
     * @return list<string>
     */
    public function codesMdrExclus(): array
    {
        $codes = [];
        foreach ($this->exclusionRapRepository->lister('MDR') as $e) {
            $codes[] = $e->getCode();
        }

        return $codes !== [] ? $codes : CalculRapFiltres::MDR_EXCLUS_DEFAUT;
    }

    /**
     * @return list<string>
     */
    public function codesOrdonnancesExclues(): array
    {
        $codes = [];
        foreach ($this->exclusionRapRepository->lister('ORDONNANCE') as $e) {
            $codes[] = $e->getCode();
        }

        return $codes;
    }

    /**
     * Assure la présence de la nature fixe COTISATIONS INTERNATIONALES.
     */
    public function assurerNatureCotisations(): void
    {
        foreach ($this->exclusionRapRepository->lister('NATURE') as $e) {
            if (strcasecmp($e->getCode(), CalculRapFiltres::NATURE_EXCLUE_AVANT_BOP) === 0) {
                return;
            }
        }
    }

    /**
     * @param array<string, mixed> $ligne
     *
     * @return array{retenue: bool, motif: ?string}
     */
    public function filtrer(array $ligne, bool $avantBop, bool $modeBop, bool $estCreditDelegue = false): array
    {
        return CalculRapFiltres::filtrerLigne(
            $ligne,
            $avantBop,
            $modeBop,
            $this->codesMdrExclus(),
            $this->codesOrdonnancesExclues(),
            $estCreditDelegue,
        );
    }

    /**
     * Statut Arriérés / Instances selon délai exercice.
     *
     * @return array{statut: string, est_arriere: bool}
     */
    public function statutArriere(
        \DateTimeInterface $echeance,
        \DateTimeInterface $dateValeur,
        int $delaiJours,
    ): array {
        $arriere = ClassementCreditDelegue::estArriereRap($echeance, $dateValeur, $delaiJours);

        return [
            'statut' => $arriere ? 'ARRIERE' : 'INSTANCE',
            'est_arriere' => $arriere,
        ];
    }

    /**
     * Règles fixes exposées en lecture seule (UI).
     *
     * @return list<array{numero: int, libelle: string, source: string}>
     */
    public function reglesFixes(): array
    {
        return [
            [
                'numero' => 1,
                'libelle' => 'Les crédits délégués dont le RAP est négatif ou nul sont exclus.',
                'source' => 'manuel SOF p. 10',
            ],
            [
                'numero' => 2,
                'libelle' => 'Les lignes de catégorie autre que TPG, AGC ou ENT sont retirées.',
                'source' => 'Methods.donnees_rap',
            ],
            [
                'numero' => 3,
                'libelle' => 'RAP avant BOP : seule la catégorie ENT est gardée.',
                'source' => 'Methods.donnees_rap',
            ],
            [
                'numero' => 4,
                'libelle' => 'RAP mode BOP, exercice 2015 : seule la catégorie ENT est gardée.',
                'source' => 'Methods.donnees_rap',
            ],
        ];
    }
}
