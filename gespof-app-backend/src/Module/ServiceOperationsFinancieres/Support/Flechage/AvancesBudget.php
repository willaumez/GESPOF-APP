<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Support\Flechage;

/**
 * Pipeline avances au budget — SPEC §6.2.
 */
final class AvancesBudget
{
    /**
     * @return array{code: string, titre: int, titre_bud: int, exercice: string}
     */
    public static function classer(
        ?string $compte,
        ?string $cNop,
        int|string|null $cNat,
        int $annee,
        bool $compatExcel = true,
    ): array {
        $nat = (int) $cNat;
        $an = $annee % 100;
        $suffixe = strlen(trim((string) $compte)) >= 2
            ? substr(trim((string) $compte), -2)
            : '';
        $exercice = $suffixe === sprintf('%02d', $an) ? 'EX' : 'ANT';

        $titre = TitreAb::titre($nat, false);
        if ($nat < 100) {
            $code = Abcd::code($compte, $cNop, $nat, $an, $compatExcel);
        } else {
            $type = $exercice === 'EX' ? 'EX' : 'ANT';
            $r = Reglements::code('REG', $type, $titre, $nat, 0, $compatExcel);
            $code = $r['code'];
        }

        $titreBud = TitreAvances::titre($nat, strlen($code), $titre);

        return [
            'code' => $code,
            'titre' => $titre,
            'titre_bud' => $titreBud,
            'exercice' => $exercice,
        ];
    }
}
