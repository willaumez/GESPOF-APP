<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Support\Flechage;

/**
 * VBA CorrespondantsR(Catégorie) — SPEC §5.5.
 */
final class CorrespondantsR
{
    public static function code(?string $categorie): string
    {
        $cat = self::normaliser($categorie);

        if (self::match($cat, ['agences comptables', 'angt'])) {
            return 'AZ';
        }
        if (self::match($cat, [
            'autres correspondants',
            'correspondants : cnss',
            'cnss',
            'correspondants : fonds de dev. du sport',
            'fonds de dev',
            'assurance maladie cnamgs',
            'cnamgs',
        ])) {
            return 'AAA';
        }
        if (self::match($cat, ['cautions'])) {
            return 'AAB';
        }
        if (self::match($cat, ['collectivites locales', 'collectivités locales'])) {
            return 'AAG';
        }
        if (self::match($cat, ['consignations'])) {
            return 'AAC';
        }
        if (self::match($cat, ['excedents', 'excédents'])) {
            return 'AAD';
        }
        if (self::match($cat, ['fonds communs'])) {
            return 'AAE';
        }

        return 'NONE';
    }

    private static function normaliser(?string $s): string
    {
        $s = mb_strtolower(trim((string) $s));
        $s = strtr($s, ['é' => 'e', 'è' => 'e', 'ê' => 'e', 'à' => 'a', 'ù' => 'u', 'ô' => 'o', 'î' => 'i', 'ç' => 'c']);

        return preg_replace('/\s+/', ' ', $s) ?? $s;
    }

    /**
     * @param list<string> $patterns
     */
    private static function match(string $cat, array $patterns): bool
    {
        foreach ($patterns as $p) {
            $p = self::normaliser($p);
            if ($cat === $p || str_contains($cat, $p)) {
                return true;
            }
        }

        return false;
    }
}
