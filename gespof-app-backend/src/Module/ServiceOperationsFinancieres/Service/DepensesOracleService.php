<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Service;

use App\Module\ServiceOperationsFinancieres\Repository\ScriptPoolSof;
use App\Shared\Exception\DonneesInvalidesException;

class DepensesOracleService
{
    public function __construct(
        private readonly ScriptPoolSof $scriptPoolSof,
    ) {
    }

    /**
     * Avances au budget — compte 4701-5* (État).
     *
     * @return array<string, mixed>
     */
    public function extraireAvancesEtat(string $dateDebut, string $dateFin): array
    {
        return $this->extraireOperationsDope(
            $dateDebut,
            $dateFin,
            'avances_etat',
            'Avances au budget — État (4701-5*)',
            fn (string $d, string $f): array => $this->scriptPoolSof->extraireDepensesAvancesBudgetEtat($d, $f),
            'Aucune avance au budget (État) pour cette période.',
        );
    }

    /**
     * Avances au budget — compte 4706-1* (Poste).
     *
     * @return array<string, mixed>
     */
    public function extraireAvancesPoste(string $dateDebut, string $dateFin): array
    {
        return $this->extraireOperationsDope(
            $dateDebut,
            $dateFin,
            'avances_poste',
            'Avances au budget — Poste (4706-1*)',
            fn (string $d, string $f): array => $this->scriptPoolSof->extraireDepensesAvancesBudgetPoste($d, $f),
            'Aucune avance au budget (Poste) pour cette période.',
        );
    }

    /**
     * Crédits délégués — compte 4742-%.
     *
     * @return array<string, mixed>
     */
    public function extraireCreditsDelegues(string $dateDebut, string $dateFin): array
    {
        return $this->extraireOperationsDope(
            $dateDebut,
            $dateFin,
            'credits_delegues',
            'Crédits délégués (4742-)',
            fn (string $d, string $f): array => $this->scriptPoolSof->extraireDepensesCreditsDelegues($d, $f),
            'Aucun règlement sur crédits délégués pour cette période.',
        );
    }

    /**
     * Règlements de l'exercice (ordonnances, origine B).
     *
     * @return array<string, mixed>
     */
    public function extraireReglements(string $dateDebut, string $dateFin): array
    {
        [$debut, $fin] = $this->validerPeriode($dateDebut, $dateFin);
        $dateDeb = $debut->format('d/m/Y');
        $dateFinFmt = $fin->format('d/m/Y');

        try {
            $lignesBrutes = $this->scriptPoolSof->extraireDepensesReglementExercice($dateDeb, $dateFinFmt);
        } catch (\Throwable $e) {
            throw new DonneesInvalidesException(
                'Impossible d\'extraire les règlements de l\'exercice : '.$e->getMessage(),
            );
        }

        $lignes = [];
        $total = 0.0;
        foreach ($lignesBrutes as $ligne) {
            $normalisee = $this->normaliserReglementExercice($ligne);
            $lignes[] = $normalisee;
            $total += (float) $normalisee['montant_regle'];
        }

        return [
            'date_debut' => $dateDeb,
            'date_fin' => $dateFinFmt,
            'etape' => 'reglements',
            'etape_libelle' => 'Règlements (ordonnances)',
            'lignes' => $lignes,
            'nombre' => \count($lignes),
            'total' => number_format($total, 2, '.', ''),
            'message' => $lignes === []
                ? 'Aucun règlement d\'ordonnance pour cette période.'
                : null,
        ];
    }

    /**
     * États de liquidation (déversements IG).
     *
     * @return array<string, mixed>
     */
    public function extraireEtatsLiquidation(string $dateDebut, string $dateFin): array
    {
        [$debut, $fin] = $this->validerPeriode($dateDebut, $dateFin);
        $dateDeb = $debut->format('d/m/Y');
        $dateFinFmt = $fin->format('d/m/Y');

        try {
            $lignesBrutes = $this->scriptPoolSof->extraireDepensesEtatsLiquidation($dateDeb, $dateFinFmt);
        } catch (\Throwable $e) {
            throw new DonneesInvalidesException(
                'Impossible d\'extraire les états de liquidation : '.$e->getMessage(),
            );
        }

        $lignes = [];
        $total = 0.0;
        foreach ($lignesBrutes as $ligne) {
            $normalisee = $this->normaliserEtatLiquidation($ligne);
            $lignes[] = $normalisee;
            $total += (float) $normalisee['m_net'];
        }

        return [
            'date_debut' => $dateDeb,
            'date_fin' => $dateFinFmt,
            'etape' => 'etats_liquidation',
            'etape_libelle' => 'États de liquidation',
            'lignes' => $lignes,
            'nombre' => \count($lignes),
            'total' => number_format($total, 2, '.', ''),
            'message' => $lignes === []
                ? 'Aucun état de liquidation pour cette période.'
                : null,
        ];
    }

    /**
     * @param callable(string, string): list<array<string, mixed>> $extracteur
     *
     * @return array<string, mixed>
     */
    private function extraireOperationsDope(
        string $dateDebut,
        string $dateFin,
        string $etape,
        string $etapeLibelle,
        callable $extracteur,
        string $messageVide,
    ): array {
        [$debut, $fin] = $this->validerPeriode($dateDebut, $dateFin);
        $dateDeb = $debut->format('d/m/Y');
        $dateFinFmt = $fin->format('d/m/Y');

        try {
            $lignesBrutes = $extracteur($dateDeb, $dateFinFmt);
        } catch (\Throwable $e) {
            throw new DonneesInvalidesException(
                sprintf('Impossible d\'extraire %s : %s', $etapeLibelle, $e->getMessage()),
            );
        }

        $lignes = [];
        $total = 0.0;
        foreach ($lignesBrutes as $ligne) {
            $normalisee = $this->normaliserOperationDope($ligne);
            $lignes[] = $normalisee;
            $total += (float) $normalisee['m_regl'];
        }

        return [
            'date_debut' => $dateDeb,
            'date_fin' => $dateFinFmt,
            'etape' => $etape,
            'etape_libelle' => $etapeLibelle,
            'lignes' => $lignes,
            'nombre' => \count($lignes),
            'total' => number_format($total, 2, '.', ''),
            'message' => $lignes === [] ? $messageVide : null,
        ];
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
     * @param array<string, mixed> $ligne
     *
     * @return array<string, mixed>
     */
    private function normaliserOperationDope(array $ligne): array
    {
        return [
            'c_pca' => $this->texte($this->cellule($ligne, 'C_PCA')),
            'n_op' => $this->texte($this->cellule($ligne, 'N_OP')),
            'c_guic' => $this->texte($this->cellule($ligne, 'C_GUIC')),
            'n_mattir' => $this->texte($this->cellule($ligne, 'N_MATTIR')),
            'c_mattir' => $this->texte($this->cellule($ligne, 'C_MATTIR')),
            'l_np' => $this->texte($this->cellule($ligne, 'L_NP')),
            'n_lig_op' => $this->texte($this->cellule($ligne, 'N_LIG_OP')),
            'c_ope' => $this->texte($this->cellule($ligne, 'C_OPE')),
            'c_it' => $this->texte($this->cellule($ligne, 'C_IT')),
            'c_nat' => $this->texte($this->cellule($ligne, 'C_NAT')),
            'c_ref1' => $this->texte($this->cellule($ligne, 'C_REF1')),
            'c_ref2' => $this->texte($this->cellule($ligne, 'C_REF2')),
            'm_oper' => $this->montant($this->cellule($ligne, 'M_OPER')),
            'n_regl' => $this->texte($this->cellule($ligne, 'N_REGL')),
            'n_lig_r' => $this->texte($this->cellule($ligne, 'N_LIG_R')),
            'm_regl' => $this->montant($this->cellule($ligne, 'M_REGL')),
            'c_nop' => $this->texte($this->cellule($ligne, 'C_NOP')),
            'c_mdr' => $this->texte($this->cellule($ligne, 'C_MDR')),
            'n_cheq' => $this->texte($this->cellule($ligne, 'N_CHEQ')),
            'd_cpta' => $this->formaterDate($this->cellule($ligne, 'D_CPTA')),
            'c_cais' => $this->texte($this->cellule($ligne, 'C_CAIS')),
        ];
    }

    /**
     * @param array<string, mixed> $ligne
     *
     * @return array<string, mixed>
     */
    private function normaliserReglementExercice(array $ligne): array
    {
        return [
            'n_ordo' => $this->texte($this->cellule($ligne, 'N_ORDO')),
            'n_regl' => $this->texte($this->cellule($ligne, 'N_REGL')),
            'd_emis' => $this->formaterDate($this->premiereCellule($ligne, ['Dat Emis', 'DAT EMIS', 'D_EMIS'])),
            'd_regl' => $this->formaterDate($this->premiereCellule($ligne, ['Dat Régl', 'DAT RÉGL', 'DAT REGL', 'D_REGL'])),
            'matricule' => $this->texte($this->premiereCellule($ligne, ['Matricule', 'MATRICULE', 'N_MATTIR'])),
            'nom_beneficiaire' => $this->texte($this->premiereCellule($ligne, ['Nom Bénéficiaire', 'NOM BÉNÉFICIAIRE', 'NOM BENEFICIAIRE'])),
            'c_mdr' => $this->texte($this->premiereCellule($ligne, ['Mdr', 'MDR', 'C_MDR'])),
            'objet' => $this->texte($this->premiereCellule($ligne, ['Objet de la Dépense', 'OBJET DE LA DÉPENSE', 'OBJET DE LA DEPENSE'])),
            'titr' => $this->texte($this->premiereCellule($ligne, ['Titr', 'TITR', 'C_TITR'])),
            'pc' => $this->texte($this->premiereCellule($ligne, ['PC', 'C_PCB'])),
            'categ' => $this->texte($this->premiereCellule($ligne, ['Categ', 'CATEG'])),
            'montant_regle' => $this->montant($this->premiereCellule($ligne, ['Montant Réglé', 'MONTANT RÉGLÉ', 'MONTANT REGLE', 'M_REGL'])),
            'montant_net' => $this->montant($this->premiereCellule($ligne, ['Montant Net', 'MONTANT NET', 'M_NET'])),
        ];
    }

    /**
     * @param array<string, mixed> $ligne
     *
     * @return array<string, mixed>
     */
    private function normaliserEtatLiquidation(array $ligne): array
    {
        return [
            'c_dev' => $this->texte($this->cellule($ligne, 'C_DEV')),
            'l_dev' => $this->texte($this->cellule($ligne, 'L_DEV')),
            'd_dev' => $this->formaterDate($this->cellule($ligne, 'D_DEV')),
            'd_valeur' => $this->formaterDate($this->cellule($ligne, 'D_VALEUR')),
            'nombre' => $this->texte($this->cellule($ligne, 'NOMBRE')),
            'm_brut' => $this->montant($this->cellule($ligne, 'M_BRUT')),
            'm_net' => $this->montant($this->cellule($ligne, 'M_NET')),
            'd_valid' => $this->formaterDate($this->cellule($ligne, 'D_VALID')),
        ];
    }

    /**
     * @param array<string, mixed> $ligne
     * @param list<string>         $cles
     */
    private function premiereCellule(array $ligne, array $cles): mixed
    {
        foreach ($cles as $cle) {
            $valeur = $this->cellule($ligne, $cle);
            if ($valeur !== null && $valeur !== '') {
                return $valeur;
            }
        }

        return null;
    }

    /** @param array<string, mixed> $ligne */
    private function cellule(array $ligne, string $cle): mixed
    {
        foreach ($ligne as $nom => $valeur) {
            if (strcasecmp((string) $nom, $cle) === 0) {
                return $valeur;
            }
        }

        return null;
    }

    private function formaterDate(mixed $valeur): ?string
    {
        if ($valeur === null || $valeur === '') {
            return null;
        }
        if ($valeur instanceof \DateTimeInterface) {
            return $valeur->format('d/m/Y');
        }
        $brut = trim((string) $valeur);
        foreach (['Y-m-d H:i:s', 'Y-m-d', 'd/m/Y', 'd-M-y'] as $format) {
            $date = \DateTimeImmutable::createFromFormat('!'.$format, $brut);
            if ($date instanceof \DateTimeImmutable) {
                return $date->format('d/m/Y');
            }
        }

        return $brut;
    }

    private function texte(mixed $valeur): ?string
    {
        if ($valeur === null) {
            return null;
        }
        $texte = trim((string) $valeur);

        return $texte === '' ? null : $texte;
    }

    private function montant(mixed $valeur): string
    {
        if ($valeur === null || $valeur === '') {
            return '0.00';
        }
        $n = is_numeric($valeur) ? (string) $valeur : preg_replace('/[^\d.,-]/', '', (string) $valeur) ?? '0';
        $n = str_replace(',', '.', $n);
        if (!is_numeric($n)) {
            return '0.00';
        }

        return number_format((float) $n, 2, '.', '');
    }
}
