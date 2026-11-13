<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Support\Flechage;

/**
 * VBA Titre_AB(nat, cdel) — SPEC §6.2.
 */
final class TitreAb
{
    public static function titre(int|string|null $nat, bool $cdel = false): int
    {
        $nat = (int) $nat;
        if (!$cdel && $nat <= 100) {
            return 0;
        }

        $g = intdiv($nat, 10000);

        return match (true) {
            $g === 67 => 1,
            $g === 66 => $cdel ? 0 : 2,
            in_array($g, [60, 61, 62], true) => 3,
            in_array($g, [63, 64], true) => 4,
            $g >= 20 && $g <= 26 => 5,
            $g === 65 => 6,
            default => 0,
        };
    }
}
