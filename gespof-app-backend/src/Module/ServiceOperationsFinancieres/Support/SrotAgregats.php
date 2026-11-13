<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Support;

/**
 * Agrégats SROT — codes RD Model / nomenclature (SPEC §8).
 * Les formules Excel Rnn / Dnn sont traduites vers ces codes métier.
 */
final class SrotAgregats
{
    /** @return list<string> */
    public static function codesPetrole(): array
    {
        return ['103', '211', '261', '263', '262', '265', '264', '266'];
    }

    /** @return list<string> */
    public static function codesDouanes(): array
    {
        return ['300'];
    }

    /** @return list<string> */
    public static function codesFiscalesHorsDouanes(): array
    {
        return [
            '184', '185', '400', '401', '187', '186', '188', '163', '192', '191', '156',
            '119', '104', '105', '121', '124', '128', '127', '139',
            '147', '140', '138', '199',
        ];
    }

    /** @return list<string> */
    public static function codesNonFiscales(): array
    {
        return ['213', '270', '290', '250', '317'];
    }

    /** @return list<string> */
    public static function codesCotisationsSociales(): array
    {
        return ['190', '189', '420', '410', '181', '130'];
    }

    /** @return list<string> */
    public static function codesRecettesAffectees(): array
    {
        return [
            '310', '311', '312', '313', '314', '314A', '315', '315A', '316', '319',
            '190', '189', '420', '410', '181', '130',
        ];
    }

    /** @return list<string> */
    public static function codesTvaRemboursements(): array
    {
        return ['400', '401'];
    }

    /** @return list<string> */
    public static function codesEmpruntsFinancement(): array
    {
        return ['AUU', 'AV', 'AW', 'AX', 'AY', 'AY2', 'AY3'];
    }

    /** Dépenses exercices antérieurs (codes feuille RD Model). */
    public static function codesDepensesAnt(): array
    {
        return ['A', 'B', 'B2', 'C', 'D', 'D1', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M'];
    }

    /** Personnel courant. */
    public static function codesPersonnelCourant(): array
    {
        return ['N', 'O', 'P'];
    }

    public static function codesInteretsCourant(): array
    {
        return ['Q', 'R', 'S', 'T', 'U'];
    }

    public static function codesBiensServicesCourant(): array
    {
        return ['V', 'W', 'X', 'Y', 'Z'];
    }

    public static function codesTransfertsCourant(): array
    {
        return ['AA', 'AB', 'AC', 'AD', 'AE', 'AF', 'AG'];
    }

    public static function codesInvestissementCourant(): array
    {
        return ['AH'];
    }

    public static function codesAgencesCourant(): array
    {
        return ['AJ', 'AK'];
    }

    public static function codesCreditsDeleguesCourant(): array
    {
        return ['AI'];
    }

    public static function codesAutresCourant(): array
    {
        return ['AK1', 'AK2'];
    }

    /** Dépenses budgétaires courant (hors sans ordonnancement). */
    public static function codesDepensesCourantBudgetaires(): array
    {
        return array_merge(
            self::codesPersonnelCourant(),
            self::codesInteretsCourant(),
            self::codesBiensServicesCourant(),
            self::codesTransfertsCourant(),
            self::codesInvestissementCourant(),
            self::codesCreditsDeleguesCourant(),
            self::codesAgencesCourant(),
            self::codesAutresCourant(),
        );
    }

    public static function codesCapitalDetteExt(): array
    {
        return ['AZ'];
    }

    public static function codesCapitalDetteInt(): array
    {
        return ['AAA'];
    }

    public static function codesRemboursementsBta(): array
    {
        return ['AAB'];
    }

    public static function codesRemboursementsFacilites(): array
    {
        return ['AAC'];
    }

    public static function codesRemboursementsDts(): array
    {
        return ['AAD'];
    }

    /**
     * Σ codes × mois (ou cumul 1..mois).
     *
     * @param array<string, array<int, string>> $index
     * @param list<string>                      $codes
     */
    public static function somme(array $index, array $codes, int $mois, bool $cumul): string
    {
        $s = '0.00';
        foreach ($codes as $code) {
            $par = $index[$code] ?? [];
            if ($cumul) {
                for ($i = 1; $i <= $mois; ++$i) {
                    $s = bcadd($s, $par[$i] ?? '0.00', 2);
                }
            } else {
                $s = bcadd($s, $par[$mois] ?? '0.00', 2);
            }
        }

        return $s;
    }

    public static function sub(string $a, string $b): string
    {
        return bcsub($a, $b, 2);
    }

    public static function add(string $a, string $b): string
    {
        return bcadd($a, $b, 2);
    }

    /** FCFA → millions (affichage Excel). */
    public static function enMillions(string $fcfa): string
    {
        return bcdiv($fcfa, '1000000', 6);
    }
}
