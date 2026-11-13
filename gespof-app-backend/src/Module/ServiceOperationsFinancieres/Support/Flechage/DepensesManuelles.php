<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Support\Flechage;

/**
 * Correspondance codes dépenses manuelles — SPEC §6.5.
 */
final class DepensesManuelles
{
    /** @var array<string, string> libellé normalisé → code SROT */
    private const MAP = [
        'interets dette interieure' => 'Q',
        'interets dette exterieure' => 'R',
        'interets bta' => 'U',
        'facilites et agios' => 'T',
        'interets facilites' => 'T',
        'agios' => 'T',
        'principal interieur dgd' => 'AAA',
        'principal interieur' => 'AAA',
        'principal ota' => 'AAE3',
        'capital ota' => 'AAE3',
        'principal exterieur' => 'AZ',
        'bta remboursements' => 'AAB',
        'bta tirages' => 'AAE1',
        'facilites remboursements' => 'AAC',
        'facilites tirages' => 'AAE2',
        'solde permanente' => 'N',
        'monp' => 'P',
        'rappel' => 'O',
        'pensions' => 'AF',
        'fonds de riposte' => 'AO2',
        'riposte' => 'AO2',
        'fonds de solidarite' => 'AO3',
        'solidarite' => 'AO3',
        'dts remboursements' => 'AAD',
        'emission ota' => 'AAE4',
        'avance beac' => 'AAE5',
        'emprunts exterieurs' => 'AAE6',
        'emprunts interieurs' => 'AAE7',
        'dts tirages' => 'AAE9',
        'dts' => 'AAE9',
        'appuis budgetaires' => 'AAE8',
        'retenues pension' => '410',
        'retenues assurance maladie' => '420',
    ];

    public static function code(?string $libelleLigne): string
    {
        $n = self::normaliser($libelleLigne);
        if ($n === '') {
            return '';
        }
        if (isset(self::MAP[$n])) {
            return self::MAP[$n];
        }
        foreach (self::MAP as $cle => $code) {
            if (str_contains($n, $cle)) {
                return $code;
            }
        }

        return '';
    }

    /**
     * @return list<array{libelle: string, code: string}>
     */
    public static function tableDecision(): array
    {
        $out = [];
        foreach (self::MAP as $libelle => $code) {
            $out[] = ['libelle' => $libelle, 'code' => $code];
        }

        return $out;
    }

    private static function normaliser(?string $s): string
    {
        $s = mb_strtolower(trim((string) $s));
        $s = strtr($s, ['é' => 'e', 'è' => 'e', 'ê' => 'e', 'à' => 'a', 'ù' => 'u', 'ô' => 'o', 'î' => 'i', 'ç' => 'c']);

        return preg_replace('/\s+/', ' ', $s) ?? $s;
    }
}
