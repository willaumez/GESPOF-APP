<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Support;

/**
 * Règles fixes Methods.donnees_rap (SPEC §3.2 / §10.1) — filtrages unitaires Lot 1.
 */
final class CalculRapFiltres
{
    public const CATEGORIES_AUTORISEES = ['TPG', 'AGC', 'ENT'];

    public const MDR_EXCLUS_DEFAUT = ['710', '730', '750', '780', '800', '850', '900'];

    public const NATURE_EXCLUE_AVANT_BOP = 'COTISATIONS INTERNATIONALES';

    /**
     * Crédits délégués : garder RAP > 0 (manuel SOF p. 10).
     */
    public static function creditDelegueRapPositif(string $rap): bool
    {
        return bccomp($rap, '0.00', 2) === 1;
    }

    /**
     * Catégories autres que TPG, AGC, ENT retirées.
     */
    public static function categorieAutorisee(?string $cCateg): bool
    {
        $c = strtoupper(trim((string) $cCateg));

        return in_array($c, self::CATEGORIES_AUTORISEES, true);
    }

    /**
     * RAP avant BOP : seule catégorie ENT ; EX 2015 mode BOP : seule ENT.
     */
    public static function categorieSelonContexte(
        ?string $cCateg,
        bool $avantBop,
        ?int $exerciceLigne,
    ): bool {
        $c = strtoupper(trim((string) $cCateg));
        if ($avantBop) {
            return $c === 'ENT';
        }
        if ($exerciceLigne === 2015) {
            return $c === 'ENT';
        }

        return self::categorieAutorisee($c);
    }

    /**
     * NATURE = Cotisations internationales exclue sur RAP avant BOP uniquement.
     */
    public static function natureExclueAvantBop(?string $nature, bool $avantBop): bool
    {
        if (!$avantBop) {
            return false;
        }

        return strcasecmp(trim((string) $nature), self::NATURE_EXCLUE_AVANT_BOP) === 0;
    }

    /**
     * @param list<string> $mdrExclus
     */
    public static function mdrExclu(?string $mdr, array $mdrExclus, bool $modeBop): bool
    {
        if (!$modeBop) {
            return false;
        }
        $code = trim((string) $mdr);
        if ($code === '') {
            return false;
        }

        return in_array($code, $mdrExclus, true);
    }

    /**
     * @param list<string> $ordonnancesExclues
     */
    public static function ordonnanceExclue(?string $ordonnance, array $ordonnancesExclues): bool
    {
        $code = trim((string) $ordonnance);
        if ($code === '') {
            return false;
        }

        return in_array($code, $ordonnancesExclues, true);
    }

    /**
     * Applique le pipeline de filtres sur une ligne RAP (avant agrégation).
     *
     * @param array{
     *   nature?: ?string,
     *   c_categ?: ?string,
     *   mdr?: ?string,
     *   ordonnance?: ?string,
     *   exercice?: ?int,
     *   rap?: string
     * } $ligne
     * @param list<string> $mdrExclus
     * @param list<string> $ordonnancesExclues
     *
     * @return array{retenue: bool, motif: ?string}
     */
    public static function filtrerLigne(
        array $ligne,
        bool $avantBop,
        bool $modeBop,
        array $mdrExclus,
        array $ordonnancesExclues,
        bool $estCreditDelegue = false,
    ): array {
        if ($estCreditDelegue) {
            $rap = (string) ($ligne['rap'] ?? '0');
            if (!self::creditDelegueRapPositif($rap)) {
                return ['retenue' => false, 'motif' => 'RAP_NEGATIF_OU_NUL'];
            }
        }

        if (self::natureExclueAvantBop($ligne['nature'] ?? null, $avantBop)) {
            return ['retenue' => false, 'motif' => 'NATURE_COTISATIONS_INTERNATIONALES'];
        }

        if (self::mdrExclu($ligne['mdr'] ?? null, $mdrExclus, $modeBop)) {
            return ['retenue' => false, 'motif' => 'MDR_EXCLU'];
        }

        if (self::ordonnanceExclue($ligne['ordonnance'] ?? null, $ordonnancesExclues)) {
            return ['retenue' => false, 'motif' => 'ORDONNANCE_EXCLUE'];
        }

        $exercice = isset($ligne['exercice']) ? (int) $ligne['exercice'] : null;
        if (!self::categorieSelonContexte($ligne['c_categ'] ?? null, $avantBop, $exercice)) {
            return ['retenue' => false, 'motif' => 'CATEGORIE_NON_AUTORISEE'];
        }

        return ['retenue' => true, 'motif' => null];
    }
}
