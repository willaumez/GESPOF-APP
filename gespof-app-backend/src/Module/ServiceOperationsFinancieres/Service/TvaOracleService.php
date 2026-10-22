<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Service;

use App\Module\ServiceOperationsFinancieres\Repository\ScriptPoolSof;
use App\Shared\Exception\DonneesInvalidesException;

class TvaOracleService
{
    public function __construct(
        private readonly ScriptPoolSof $scriptPoolSof,
    ) {
    }

    /**
     * Restes à payer TVA — compte 4781-31 / nature 81.
     *
     * @return array<string, mixed>
     */
    public function extraireRap(string $dateDebut, string $dateFin): array
    {
        [$debut, $fin] = $this->validerPeriode($dateDebut, $dateFin);
        $dateDeb = $debut->format('d/m/Y');
        $dateFinFmt = $fin->format('d/m/Y');

        try {
            $lignesBrutes = $this->scriptPoolSof->extraireDepensesResteAPayer478131($dateDeb, $dateFinFmt);
        } catch (\Throwable $e) {
            throw new DonneesInvalidesException(
                'Impossible d\'extraire les RAP TVA : '.$e->getMessage(),
            );
        }

        $lignes = [];
        $total = 0.0;
        foreach ($lignesBrutes as $ligne) {
            $normalisee = $this->normaliserRap($ligne);
            $lignes[] = $normalisee;
            $total += (float) $normalisee['rap'];
        }

        return [
            'date_debut' => $dateDeb,
            'date_fin' => $dateFinFmt,
            'etape' => 'rap_tva',
            'etape_libelle' => 'RAP TVA (restes à payer, 4781-31)',
            'lignes' => $lignes,
            'nombre' => \count($lignes),
            'total' => number_format($total, 2, '.', ''),
            'message' => $lignes === []
                ? 'Aucun reste à payer TVA pour cette période.'
                : null,
        ];
    }

    /**
     * Remboursements TVA (DC) — origine M, compte 4781-31.
     *
     * @return array<string, mixed>
     */
    public function extraireRemboursementsDc(string $dateDebut, string $dateFin): array
    {
        [$debut, $fin] = $this->validerPeriode($dateDebut, $dateFin);
        $dateDeb = $debut->format('d/m/Y');
        $dateFinFmt = $fin->format('d/m/Y');

        try {
            $lignesBrutes = $this->scriptPoolSof->extraireDepensesRemboursementsTvaExercice($dateDeb, $dateFinFmt);
        } catch (\Throwable $e) {
            throw new DonneesInvalidesException(
                'Impossible d\'extraire les remboursements TVA (DC) : '.$e->getMessage(),
            );
        }

        $lignes = [];
        $total = 0.0;
        foreach ($lignesBrutes as $ligne) {
            $normalisee = $this->normaliserRemboursementDc($ligne);
            $lignes[] = $normalisee;
            $total += (float) $normalisee['m_regl'];
        }

        return [
            'date_debut' => $dateDeb,
            'date_fin' => $dateFinFmt,
            'etape' => 'remboursements_tva_dc',
            'etape_libelle' => 'Remboursements TVA (DC)',
            'lignes' => $lignes,
            'nombre' => \count($lignes),
            'total' => number_format($total, 2, '.', ''),
            'message' => $lignes === []
                ? 'Aucun remboursement TVA (DC) pour cette période.'
                : null,
        ];
    }

    /**
     * Remboursements TVA (IG) — règlements DOPE compte 4781-31 / nature 81.
     *
     * @return array<string, mixed>
     */
    public function extraireRemboursementsIg(string $dateDebut, string $dateFin): array
    {
        [$debut, $fin] = $this->validerPeriode($dateDebut, $dateFin);
        $dateDeb = $debut->format('d/m/Y');
        $dateFinFmt = $fin->format('d/m/Y');

        try {
            $lignesBrutes = $this->scriptPoolSof->extraireDepensesReglementsTvaIg($dateDeb, $dateFinFmt);
        } catch (\Throwable $e) {
            throw new DonneesInvalidesException(
                'Impossible d\'extraire les remboursements TVA (IG) : '.$e->getMessage(),
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
            'etape' => 'remboursements_tva_ig',
            'etape_libelle' => 'Remboursements TVA (IG)',
            'lignes' => $lignes,
            'nombre' => \count($lignes),
            'total' => number_format($total, 2, '.', ''),
            'message' => $lignes === []
                ? 'Aucun remboursement TVA (IG) pour cette période.'
                : null,
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
    private function normaliserRemboursementDc(array $ligne): array
    {
        return [
            'n_emis' => $this->texte($this->cellule($ligne, 'N_EMIS')),
            'n_regl' => $this->texte($this->cellule($ligne, 'N_REGL')),
            'd_emis' => $this->formaterDate($this->cellule($ligne, 'D_EMIS')),
            'c_it' => $this->texte($this->cellule($ligne, 'C_IT')),
            'c_nat' => $this->texte($this->cellule($ligne, 'C_NAT')),
            'c_pc' => $this->texte($this->cellule($ligne, 'C_PC')),
            'libelle_compte' => $this->texte($this->cellule($ligne, 'LIBELLE_COMPTE')),
            'libelle_nature' => $this->texte($this->cellule($ligne, 'LIBELLE_NATURE')),
            'l_pc' => $this->texte($this->cellule($ligne, 'L_PC')),
            'c_banque' => $this->texte($this->cellule($ligne, 'C_BANQUE')),
            'c_mdr' => $this->texte($this->cellule($ligne, 'C_MDR')),
            'n_cptb' => $this->texte($this->cellule($ligne, 'N_CPTB')),
            'n_mattir' => $this->texte($this->cellule($ligne, 'N_MATTIR')),
            'nom' => $this->texte($this->cellule($ligne, 'NOM')),
            'n_benc' => $this->texte($this->cellule($ligne, 'N_BENC')),
            'm_regl' => $this->montant($this->cellule($ligne, 'M_REGL')),
            'm_net' => $this->montant($this->cellule($ligne, 'M_NET')),
            'd_regl' => $this->formaterDate($this->cellule($ligne, 'D_REGL')),
            'n_bv' => $this->texte($this->cellule($ligne, 'N_BV')),
            'n_cbanq' => $this->texte($this->cellule($ligne, 'N_CBANQ')),
            'l_ref1' => $this->texte($this->cellule($ligne, 'L_REF1')),
            'l_ref2' => $this->texte($this->cellule($ligne, 'L_REF2')),
            'l_ref3' => $this->texte($this->cellule($ligne, 'L_REF3')),
            'l_ref4' => $this->texte($this->cellule($ligne, 'L_REF4')),
        ];
    }

    /**
     * @param array<string, mixed> $ligne
     *
     * @return array<string, mixed>
     */
    private function normaliserRap(array $ligne): array
    {
        return [
            'c_pc' => $this->texte($this->cellule($ligne, 'C_PC')),
            'l_pc' => $this->texte($this->cellule($ligne, 'L_PC')),
            'n_emis' => $this->texte($this->cellule($ligne, 'N_EMIS')),
            'd_emis' => $this->formaterDate($this->cellule($ligne, 'D_EMIS')),
            'c_it' => $this->texte($this->cellule($ligne, 'C_IT')),
            'libelle_compte' => $this->texte($this->cellule($ligne, 'LIBELLE_COMPTE')),
            'c_typnat' => $this->texte($this->cellule($ligne, 'C_TYPNAT')),
            'c_nat' => $this->texte($this->cellule($ligne, 'C_NAT')),
            'libelle_nature' => $this->texte($this->cellule($ligne, 'LIBELLE_NATURE')),
            'c_mdr' => $this->texte($this->cellule($ligne, 'C_MDR')),
            'n_mattir' => $this->texte($this->cellule($ligne, 'N_MATTIR')),
            'nom' => $this->texte($this->cellule($ligne, 'NOM')),
            'n_benc' => $this->texte($this->cellule($ligne, 'N_BENC')),
            'rap' => $this->montant($this->cellule($ligne, 'RAP')),
            'd_visa' => $this->formaterDate($this->cellule($ligne, 'D_VISA')),
            'objet' => $this->texte($this->cellule($ligne, 'OBJET')),
            'ref' => $this->texte($this->cellule($ligne, 'REF')),
            'c_blocag' => $this->texte($this->cellule($ligne, 'C_BLOCAG')),
            'l_blocag' => $this->texte($this->cellule($ligne, 'L_BLOCAG')),
            'orig' => $this->texte($this->cellule($ligne, 'ORIG')),
        ];
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
