<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Support;

/**
 * Correspondance CodeM (dépenses manuelles) → code SROT recettes — SPEC §5.6.
 */
final class AppuisEmpruntsCorrespondance
{
    /**
     * @return list<array{code_m: string, code_srot: ?string, libelle: string, sens: string}>
     */
    public static function lignes(): array
    {
        return [
            ['code_m' => 'AAE5', 'code_srot' => null, 'libelle' => 'Avance BEAC', 'sens' => 'info'],
            ['code_m' => 'AAE1', 'code_srot' => 'AV', 'libelle' => 'BTA émission', 'sens' => 'recette'],
            ['code_m' => 'AAB', 'code_srot' => null, 'libelle' => 'BTA remboursement', 'sens' => 'depense'],
            ['code_m' => 'AAE4', 'code_srot' => 'AUU', 'libelle' => 'OTA émission', 'sens' => 'recette'],
            ['code_m' => 'AAE3', 'code_srot' => null, 'libelle' => 'OTA remboursement', 'sens' => 'depense'],
            ['code_m' => 'AAE2', 'code_srot' => 'AW', 'libelle' => 'Facilité émission', 'sens' => 'recette'],
            ['code_m' => 'AAC', 'code_srot' => null, 'libelle' => 'Facilité remboursement', 'sens' => 'depense'],
            ['code_m' => 'AAE6', 'code_srot' => 'AY2', 'libelle' => 'Emprunts extérieurs', 'sens' => 'recette'],
            ['code_m' => 'AAE7', 'code_srot' => 'AY', 'libelle' => 'Emprunts intérieurs', 'sens' => 'recette'],
            ['code_m' => 'AAE9', 'code_srot' => 'AX', 'libelle' => 'DTS', 'sens' => 'recette'],
            ['code_m' => 'AAE8', 'code_srot' => 'AY3', 'libelle' => 'Appuis budgétaires', 'sens' => 'recette'],
        ];
    }

    /**
     * @return array<string, string> code_m → code_srot (recettes seulement)
     */
    public static function mapRecettes(): array
    {
        $out = [];
        foreach (self::lignes() as $l) {
            if ($l['code_srot'] !== null && $l['sens'] === 'recette') {
                $out[$l['code_m']] = $l['code_srot'];
            }
        }

        return $out;
    }
}
