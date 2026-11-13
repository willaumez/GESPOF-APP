<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Support;

use App\Module\ServiceOperationsFinancieres\Enum\NatureAjustement;

/**
 * Nomenclature + correspondance SROT des ajustements (CSV SPEC §7).
 */
final class AjustementsNomenclature
{
    private static ?array $cache = null;

    /**
     * @return list<array{code: string, libelle: string, niveau: int|null}>
     */
    public static function nomenclature(NatureAjustement $nature): array
    {
        $data = self::charger();
        $cle = $nature === NatureAjustement::RECETTE ? 'nomenclature_recettes' : 'nomenclature_depenses';

        return $data[$cle];
    }

    /**
     * code_ajustement → code_srot (peut être null si regroupement).
     */
    public static function codeSrot(NatureAjustement $nature, string $codeAjustement): ?string
    {
        $data = self::charger();
        $map = $nature === NatureAjustement::RECETTE
            ? $data['correspondance_recettes']
            : $data['correspondance_depenses'];
        $code = trim($codeAjustement);
        if ($code === '' || !isset($map[$code])) {
            return null;
        }
        $srot = trim((string) $map[$code]);

        return $srot === '' ? null : $srot;
    }

    public static function libelle(NatureAjustement $nature, string $codeAjustement): ?string
    {
        foreach (self::nomenclature($nature) as $l) {
            if ($l['code'] === $codeAjustement) {
                return $l['libelle'];
            }
        }

        return null;
    }

    /**
     * @return array{
     *   nomenclature_recettes: list<array{code: string, libelle: string, niveau: int|null}>,
     *   nomenclature_depenses: list<array{code: string, libelle: string, niveau: int|null}>,
     *   correspondance_recettes: array<string, string>,
     *   correspondance_depenses: array<string, string>
     * }
     */
    private static function charger(): array
    {
        if (self::$cache !== null) {
            return self::$cache;
        }

        $base = dirname(__DIR__, 4).'/resources/sof';
        self::$cache = [
            'nomenclature_recettes' => self::lireNomenclature($base.'/ajustements-nomenclature-recettes.csv'),
            'nomenclature_depenses' => self::lireNomenclature($base.'/ajustements-nomenclature-depenses.csv'),
            'correspondance_recettes' => self::lireCorrespondance($base.'/correspondance-ajustements-recettes.csv'),
            'correspondance_depenses' => self::lireCorrespondance($base.'/correspondance-ajustements-depenses.csv'),
        ];

        return self::$cache;
    }

    /**
     * @return list<array{code: string, libelle: string, niveau: int|null}>
     */
    private static function lireNomenclature(string $path): array
    {
        if (!is_readable($path)) {
            return [];
        }
        $fh = fopen($path, 'rb');
        if ($fh === false) {
            return [];
        }
        $out = [];
        $header = fgetcsv($fh, 0, ';');
        while (($row = fgetcsv($fh, 0, ';')) !== false) {
            $code = trim((string) ($row[0] ?? ''));
            $libelle = trim((string) ($row[1] ?? ''));
            if ($code === '' || $libelle === '') {
                continue;
            }
            $niveau = isset($row[2]) && trim((string) $row[2]) !== '' ? (int) $row[2] : null;
            $out[] = ['code' => $code, 'libelle' => $libelle, 'niveau' => $niveau];
        }
        fclose($fh);

        return $out;
    }

    /**
     * @return array<string, string> code_ajustement → code_rd_model
     */
    private static function lireCorrespondance(string $path): array
    {
        if (!is_readable($path)) {
            return [];
        }
        $fh = fopen($path, 'rb');
        if ($fh === false) {
            return [];
        }
        $header = fgetcsv($fh, 0, ';');
        $idxCodeAj = array_search('code_ajustement', $header ?: [], true);
        $idxCodeRd = array_search('code_rd_model', $header ?: [], true);
        if ($idxCodeAj === false || $idxCodeRd === false) {
            fclose($fh);

            return [];
        }
        $out = [];
        while (($row = fgetcsv($fh, 0, ';')) !== false) {
            $codeAj = trim((string) ($row[$idxCodeAj] ?? ''));
            $codeRd = trim((string) ($row[$idxCodeRd] ?? ''));
            if ($codeAj === '') {
                continue;
            }
            $out[$codeAj] = $codeRd;
        }
        fclose($fh);

        return $out;
    }
}
