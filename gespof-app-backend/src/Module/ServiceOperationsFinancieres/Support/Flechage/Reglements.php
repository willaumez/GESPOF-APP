<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Support\Flechage;

/**
 * VBA Reglements(CATEG, TYPE, TITRE, NAT, MDR) — SPEC §6.1.
 * Compat Excel : test V (nat3 ∈ {6051,6052,6053}) jamais vrai si compatExcel=true (bogue B1).
 */
final class Reglements
{
    /**
     * @return array{code: string, motif: ?string}
     */
    public static function code(
        ?string $categ,
        ?string $type,
        int|string|null $titre,
        int|string|null $nat,
        int|string|null $mdr = 0,
        bool $compatExcel = true,
    ): array {
        $categ = strtoupper(trim((string) $categ));
        $type = strtoupper(trim((string) $type));
        $titre = (int) $titre;
        $nat = (int) $nat;
        $mdr = (int) $mdr;

        if (!in_array($categ, ['REG', 'TPG'], true) || $mdr >= 700) {
            return [
                'code' => '',
                'motif' => $mdr >= 700 ? 'MDR_GE_700' : 'CATEG_NON_RETENUE',
            ];
        }

        $nat3 = intdiv($nat, 1000);
        $nat4 = intdiv($nat, 100);
        $estAnt = $type === 'ANT' || str_starts_with($type, 'ANT');

        if ($estAnt) {
            $code = match ($titre) {
                1 => 'C',
                2 => self::titre2Ant($nat, $nat3),
                3 => 'D',
                4 => self::titre4Ant($nat3, $nat4),
                5 => 'I',
                6 => 'M',
                default => '',
            };

            return ['code' => $code, 'motif' => $code === '' ? 'TITRE_INCONNU' : null];
        }

        // Exercice courant
        $code = match ($titre) {
            1 => 'S',
            2 => self::titre2Courant($nat, $nat3),
            3 => $compatExcel ? self::titre3CourantCompat($nat3) : self::titre3CourantCorrige($nat),
            4 => self::titre4Courant($nat3, $nat4),
            5 => 'AH',
            6 => 'AK2',
            default => '',
        };

        return [
            'code' => $code,
            'motif' => $code === '' ? ($titre === 2 ? 'SOLDE_MANUELLE' : 'TITRE_INCONNU') : null,
        ];
    }

    private static function titre2Ant(int $nat, int $nat3): string
    {
        if ($nat3 === 661) {
            return 'A';
        }
        $nats = [669101, 664905, 664904, 661905, 661904, 661903, 661902, 661901];
        if (in_array($nat, $nats, true)) {
            return 'B';
        }

        return 'B2';
    }

    private static function titre4Ant(int $nat3, int $nat4): string
    {
        if ($nat4 === 6451) {
            return 'E';
        }
        if ($nat3 === 631) {
            return 'F';
        }
        if ($nat3 === 646 || $nat4 === 6454) {
            return 'G';
        }

        return 'H';
    }

    private static function titre2Courant(int $nat, int $nat3): string
    {
        if (in_array($nat3, [669, 663], true) || in_array($nat, [661103, 661107], true)) {
            return 'O';
        }

        return ''; // solde courante = dépenses manuelles
    }

    /** Bogue B1 : test V via nat3=6051… jamais vrai. */
    private static function titre3CourantCompat(int $nat3): string
    {
        if ($nat3 === 611) {
            return 'Y';
        }
        if ($nat3 === 612) {
            return 'X';
        }

        return 'Z';
    }

    /** Corrigé (compatExcel=false) : V si nat4 ∈ {6051,6052,6053}. */
    public static function titre3CourantCorrige(int $nat): string
    {
        $nat3 = intdiv($nat, 1000);
        $nat4 = intdiv($nat, 100);
        if ($nat3 === 611) {
            return 'Y';
        }
        if ($nat3 === 612) {
            return 'X';
        }
        if (in_array($nat4, [6051, 6052, 6053], true)) {
            return 'V';
        }

        return 'Z';
    }

    private static function titre4Courant(int $nat3, int $nat4): string
    {
        if ($nat4 === 6451) {
            return 'AA';
        }
        if ($nat3 === 631) {
            return 'AB';
        }
        if ($nat3 === 646) {
            return 'AC';
        }
        if ($nat3 === 648) {
            return 'AE';
        }

        return 'AG';
    }
}
