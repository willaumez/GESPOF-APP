<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Support\Flechage;

/**
 * VBA ABCD(compte, OP, nat, an) — SPEC §6.2.
 * Bogue B2 : 619101 présent dans Z et AB — seul Z est atteint (compat).
 */
final class Abcd
{
    public static function code(
        ?string $compte,
        ?string $op,
        int|string|null $nat,
        int|string|null $an,
        bool $compatExcel = true,
    ): string {
        $op = strtoupper(trim((string) $op));
        if (!in_array($op, ['N', 'B'], true)) {
            return '';
        }

        $nat = (int) $nat;
        $an = (int) $an;
        $compte = trim((string) $compte);
        $suffixe = strlen($compte) >= 2 ? substr($compte, -2) : $compte;
        $avanceCourante = $suffixe === sprintf('%02d', $an % 100);

        if ($avanceCourante) {
            return self::courant($nat, $compatExcel);
        }

        return self::anterieur($nat);
    }

    private static function courant(int $nat, bool $compatExcel): string
    {
        // Tables SPEC — ordre VBA (premier match).
        if (in_array($nat, [12, 653104], true)) {
            return 'AK1';
        }
        if ($nat === 51) {
            return 'X';
        }
        if ($nat === 53) {
            return 'V';
        }
        if (in_array($nat, [56, 611102], true)) {
            return 'Y';
        }
        // Z avant AB : 619101 tombe ici (bogue B2 voulu en compat).
        if (in_array($nat, [54, 55, 57, 59, 619101, 613201, 613209], true)) {
            return 'Z';
        }
        if ($nat === 61) {
            return 'AA';
        }
        // 619101 aussi listé en AB — inatteignable en compat.
        if ($nat === 63 || (!$compatExcel && $nat === 619101)) {
            return 'AB';
        }
        if (in_array($nat, [52, 58, 67, 69], true)) {
            return 'AK2';
        }
        if (in_array($nat, [71, 72, 79], true)) {
            return 'AH';
        }

        return '';
    }

    private static function anterieur(int $nat): string
    {
        if (in_array($nat, [31, 33], true)) {
            return 'A';
        }
        if (in_array($nat, [41, 42, 44], true)) {
            return 'B';
        }
        if ($nat === 12) {
            return 'M';
        }
        if (in_array($nat, [51, 53, 56, 54, 55, 57, 59], true)) {
            return 'D';
        }
        if ($nat === 61) {
            return 'E';
        }
        if ($nat === 63) {
            return 'F';
        }
        if (in_array($nat, [52, 58, 67, 69], true)) {
            return 'M';
        }
        if (in_array($nat, [71, 72, 79], true)) {
            return 'I';
        }

        return '';
    }
}
