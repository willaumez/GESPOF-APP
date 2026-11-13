<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Repository;

use App\Shared\ExternalSource\DatabaseReader;

/**
 * Lecture Oracle (SGP) des scripts SQL du Service des Opérations Financières.
 */
class ScriptPoolSof
{
    /** @var array<string, string> */
    private array $sqlFichierCache = [];

    /** @var array<string, list<string>> */
    private array $sqlMultiCache = [];

    public function __construct(private readonly DatabaseReader $databaseReader)
    {
    }

    /**
     * Extraction hors RUSID pour une liste de comptes (triés, 4663-218 exclu).
     *
     * @param list<string> $comptes
     *
     * @return list<array<string, mixed>>
     */
    public function extraireRecettesDouanieresCompte(
        string $dateDebut,
        string $dateFin,
        array $comptes,
    ): array {
        $comptes = array_values(array_unique(array_filter(
            array_map(static fn (mixed $c): string => trim((string) $c), $comptes),
            static fn (string $c): bool => $c !== '' && $c !== '4663-218',
        )));
        sort($comptes, \SORT_STRING);

        if ($comptes === []) {
            return [];
        }

        [$horsRusid] = $this->chargerRequetesRecettesDouanieres();

        $params = [
            'date_deb' => $dateDebut,
            'date_fin' => $dateFin,
        ];
        $placeholders = [];
        foreach ($comptes as $i => $compte) {
            $placeholders[] = ':compte_'.$i;
            $params['compte_'.$i] = $compte;
        }

        $sql = str_replace('{{comptes_list}}', implode(', ', $placeholders), $horsRusid);

        return $this->databaseReader->executeQuery($sql, $params);
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function extraireRecettesDouanieresRusid(string $dateDebut, string $dateFin): array
    {
        [, $rusid] = $this->chargerRequetesRecettesDouanieres();

        return $this->databaseReader->executeQuery($rusid, [
            'date_deb' => $dateDebut,
            'date_fin' => $dateFin,
        ]);
    }

    /**
     * Recettes pétrolières — OP BEAC agrégé (STAT.VM_REC_BEAC).
     *
     * @return list<array<string, mixed>>
     */
    public function extraireRecettesPetrolieresOpBeac(string $dateDebut, string $dateFin): array
    {
        $sql = $this->chargerSql('model-automatise-recettes-petroliere-op-beac.sql');

        return $this->databaseReader->executeQuery($sql, [
            'date_debut' => $dateDebut,
            'date_fin' => $dateFin,
        ]);
    }

    /**
     * Recettes pétrolières — états par compte (détail OP_BEAC + E-TAX).
     *
     * @return list<array<string, mixed>>
     */
    public function extraireRecettesPetrolieresEtatParCompte(string $dateDebut, string $dateFin): array
    {
        [$detail] = $this->chargerRequetesEtatParCompte();

        return $this->databaseReader->executeQuery($detail, [
            'date_debut' => $dateDebut,
            'date_fin' => $dateFin,
        ]);
    }

    /**
     * Toutes les lignes E-TAX (sgp_liir_det) des références de la période.
     *
     * @return list<array<string, mixed>>
     */
    public function extraireRecettesPetrolieresEtatParCompteDetailsEtaxPeriode(
        string $dateDebut,
        string $dateFin,
    ): array {
        [, $detailsPeriode] = $this->chargerRequetesEtatParCompte();

        return $this->databaseReader->executeQuery($detailsPeriode, [
            'date_debut' => $dateDebut,
            'date_fin' => $dateFin,
        ]);
    }

    /**
     * Lignes du détail E-TAX (sgp_liir_det) pour une référence.
     *
     * @return list<array<string, mixed>>
     */
    public function extraireRecettesPetrolieresEtatParCompteDetailEtax(string $refEtax): array
    {
        [, , $lignesDetail] = $this->chargerRequetesEtatParCompte();

        return $this->databaseReader->executeQuery($lignesDetail, [
            'ref_etax' => $refEtax,
        ]);
    }

    /**
     * Recettes pétrolières — étape B (compte 1812-201, hors N/A).
     *
     * @return list<array<string, mixed>>
     */
    public function extraireRecettesPetrolieres1812201(string $dateDebut, string $dateFin): array
    {
        $sql = $this->chargerSql('model-automatise-recettes-petroliere-1812-201.sql');

        return $this->databaseReader->executeQuery($sql, [
            'date_debut' => $dateDebut,
            'date_fin' => $dateFin,
        ]);
    }

    /**
     * Recettes pétrolières — opérations IG VIDR / F1 (numéraire + bancaire).
     *
     * @param list<string> $comptes
     *
     * @return list<array<string, mixed>>
     */
    public function extraireRecettesPetrolieresVidr(
        string $dateDebut,
        string $dateFin,
        array $comptes,
    ): array {
        $comptes = array_values(array_unique(array_filter(
            array_map(static fn (mixed $c): string => trim((string) $c), $comptes),
            static fn (string $c): bool => $c !== '',
        )));
        sort($comptes, \SORT_STRING);
        if ($comptes === []) {
            return [];
        }

        $sql = $this->chargerSql('model-automatise-recettes-petroliere-vidr.sql');
        $params = [
            'date_debut' => $dateDebut,
            'date_fin' => $dateFin,
        ];
        $placeholders = [];
        foreach ($comptes as $i => $compte) {
            $placeholders[] = ':compte_'.$i;
            $params['compte_'.$i] = $compte;
        }
        $sql = str_replace('{{comptes_list}}', implode(', ', $placeholders), $sql);

        return $this->databaseReader->executeQuery($sql, $params);
    }

    /**
     * Avances au budget — compte 4701-5* (État).
     *
     * @return list<array<string, mixed>>
     */
    public function extraireDepensesAvancesBudgetEtat(string $dateDebut, string $dateFin): array
    {
        return $this->extraireDepensesPeriode(
            'depenses-avances-budget-etat.sql',
            $dateDebut,
            $dateFin,
        );
    }

    /**
     * Avances au budget — compte 4706-1* (Poste).
     *
     * @return list<array<string, mixed>>
     */
    public function extraireDepensesAvancesBudgetPoste(string $dateDebut, string $dateFin): array
    {
        return $this->extraireDepensesPeriode(
            'depenses-avances-budget-poste.sql',
            $dateDebut,
            $dateFin,
        );
    }

    /**
     * Règlements de l'exercice (origine budgétaire B).
     *
     * @return list<array<string, mixed>>
     */
    public function extraireDepensesReglementExercice(string $dateDebut, string $dateFin): array
    {
        return $this->extraireDepensesPeriode(
            'depenses-reglement-exercice.sql',
            $dateDebut,
            $dateFin,
        );
    }

    /**
     * Règlements sur ordonnances mode BOP (F2 · XRGV) — 1er janvier → date.
     *
     * @return list<array<string, mixed>>
     */
    public function extraireDepensesReglementsOrdonnancesXrgv(string $dateDebut, string $dateFin): array
    {
        return $this->extraireDepensesPeriode(
            'depenses-reglements-ordonnances-xrgv.sql',
            $dateDebut,
            $dateFin,
        );
    }

    /**
     * Crédits délégués — compte 4742-%.
     *
     * @return list<array<string, mixed>>
     */
    public function extraireDepensesCreditsDelegues(string $dateDebut, string $dateFin): array
    {
        return $this->extraireDepensesPeriode(
            'depenses-reglements-credits-delegues.sql',
            $dateDebut,
            $dateFin,
        );
    }

    /**
     * Règlements TVA-IG — compte 4781-31 / nature 81.
     *
     * @return list<array<string, mixed>>
     */
    public function extraireDepensesReglementsTvaIg(string $dateDebut, string $dateFin): array
    {
        return $this->extraireDepensesPeriode(
            'depenses-reglements-tva-ig.sql',
            $dateDebut,
            $dateFin,
        );
    }

    /**
     * Remboursements de TVA de l'exercice (DC) — compte 4781-31 / nature 81.
     *
     * @return list<array<string, mixed>>
     */
    public function extraireDepensesRemboursementsTvaExercice(string $dateDebut, string $dateFin): array
    {
        return $this->extraireDepensesPeriode(
            'depenses-remboursements-tva-exercice.sql',
            $dateDebut,
            $dateFin,
        );
    }

    /**
     * Restes à payer TVA — compte 4781-31 / nature 81.
     *
     * @return list<array<string, mixed>>
     */
    public function extraireDepensesResteAPayer478131(string $dateDebut, string $dateFin): array
    {
        return $this->extraireDepensesPeriode(
            'depenses-reste-a-payer-4781-31.sql',
            $dateDebut,
            $dateFin,
        );
    }

    /**
     * États de liquidation (déversements IG — SOLDE ETAT / PENSIONS).
     *
     * @return list<array<string, mixed>>
     */
    public function extraireDepensesEtatsLiquidation(string $dateDebut, string $dateFin): array
    {
        return $this->extraireDepensesPeriode(
            'depenses-etats-liquidation.sql',
            $dateDebut,
            $dateFin,
        );
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function extraireDepensesPeriode(string $fichier, string $dateDebut, string $dateFin): array
    {
        $sql = $this->chargerSql($fichier);

        return $this->databaseReader->executeQuery($sql, [
            'd_debut' => $dateDebut,
            'd_fin' => $dateFin,
        ]);
    }

    /**
     * @return array{0: string, 1: string}
     */
    private function chargerRequetesRecettesDouanieres(): array
    {
        return $this->chargerRequetesMultiples(
            'model-automatise-recettes-douanieres.sql',
            2,
        );
    }

    /**
     * @return array{0: string, 1: string, 2: string}
     */
    private function chargerRequetesEtatParCompte(): array
    {
        /** @var array{0: string, 1: string, 2: string} $requetes */
        $requetes = $this->chargerRequetesMultiples(
            'model-automatise-recettes-petroliere-etat-par-compte.sql',
            3,
        );

        return $requetes;
    }

    /**
     * @return list<string>
     */
    private function chargerRequetesMultiples(string $fichier, int $attendu): array
    {
        $cle = $fichier.'#'.$attendu;
        if (isset($this->sqlMultiCache[$cle])) {
            return $this->sqlMultiCache[$cle];
        }

        $sql = $this->chargerSql($fichier);
        $parties = array_values(array_filter(
            array_map('trim', explode(';', $sql)),
            static fn (string $partie): bool => $partie !== '',
        ));

        if (\count($parties) !== $attendu) {
            throw new \RuntimeException(sprintf(
                'Le fichier %s doit contenir exactement %d requête(s).',
                $fichier,
                $attendu,
            ));
        }

        return $this->sqlMultiCache[$cle] = $parties;
    }

    private function chargerSql(string $fichier): string
    {
        if (isset($this->sqlFichierCache[$fichier])) {
            return $this->sqlFichierCache[$fichier];
        }

        $chemin = dirname(__DIR__).DIRECTORY_SEPARATOR.'Sql'.DIRECTORY_SEPARATOR.$fichier;
        $contenu = file_get_contents($chemin);
        if ($contenu === false) {
            throw new \RuntimeException(sprintf('Fichier SQL introuvable : %s', $fichier));
        }

        $lignes = preg_split('/\R/', $contenu) ?: [];
        $gardees = [];
        foreach ($lignes as $ligne) {
            $trim = ltrim($ligne);
            if ($trim === '' || str_starts_with($trim, '--')) {
                continue;
            }
            $gardees[] = $ligne;
        }

        return $this->sqlFichierCache[$fichier] = rtrim(implode("\n", $gardees), " \t\n\r;");
    }
}
