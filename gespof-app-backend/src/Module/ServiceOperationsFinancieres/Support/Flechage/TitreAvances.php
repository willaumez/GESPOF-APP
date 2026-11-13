<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Support\Flechage;

/**
 * VBA TitreAvances(num, longueur_code, titre) — SPEC §6.2.
 */
final class TitreAvances
{
    public static function titre(int|string|null $num, int $longueurCode, int $titreRecu): int
    {
        if ($longueurCode <= 0) {
            return 0;
        }
        if ($titreRecu !== 0) {
            return $titreRecu;
        }

        $num = (int) $num;

        return match (true) {
            in_array($num, [44, 41], true) => 2,
            in_array($num, [54, 55, 57, 59, 56, 51, 53], true) => 3,
            in_array($num, [63, 61], true) => 4,
            in_array($num, [71, 72, 79], true) => 5,
            in_array($num, [52, 58, 67, 69, 12], true) => 6,
            default => 0,
        };
    }
}
