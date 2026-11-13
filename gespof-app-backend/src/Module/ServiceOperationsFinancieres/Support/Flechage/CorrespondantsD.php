<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Support\Flechage;

/**
 * VBA CorrespondantsD(Catégorie, C_IT) — SPEC §6.4.
 */
final class CorrespondantsD
{
    public static function code(?string $categorie, ?string $compte = null): string
    {
        $cat = self::normaliser($categorie);
        $compte = trim((string) $compte);

        if (self::match($cat, ['agences comptables', 'angt'])) {
            return 'AJ';
        }
        if (self::match($cat, ['dettes croisees', 'dettes croisées'])) {
            return 'W';
        }
        if (self::match($cat, ['assurance maladie cnamgs', 'cnamgs'])) {
            return 'AL';
        }
        if (self::match($cat, ['autres correspondants'])) {
            return 'AO';
        }
        if (self::match($cat, ['correspondants : cnss', 'cnss'])) {
            return 'AN';
        }
        if (self::match($cat, ['correspondants : fonds de dev. du sport', 'fonds de dev'])) {
            return 'AM';
        }
        if (self::match($cat, ['autres op. de tresorerie : fds de securite', 'fds de securite', 'fonds de securite'])) {
            return 'AY';
        }
        if (self::match($cat, ['cautions'])) {
            return 'AP';
        }
        if (self::match($cat, ['collectivites locales', 'collectivités locales'])) {
            return 'AX';
        }
        if (self::match($cat, ['consignations'])) {
            return 'AQ';
        }
        if (self::match($cat, ['excedents', 'excédents'])) {
            return 'AR';
        }
        if (self::match($cat, ['bonus collecteurs', 'bonus gestionnaires', 'bonus sces centraux'])) {
            return 'AS';
        }
        if (self::match($cat, ['fonds divers', 'fonds divers : appui action du gvt'])) {
            return 'AV';
        }
        if (self::match($cat, ['primes d\'incitation', 'primes d incitation'])) {
            return 'AT';
        }
        if (self::match($cat, ['fonds communs'])) {
            if ($compte === '4663-278') {
                return 'AS';
            }
            if (preg_match('/^4663-27[0-7]$/', $compte) === 1) {
                return 'AT';
            }

            return 'AU';
        }
        if (self::match($cat, ['f.e.r.', 'fer', 'f.e.r'])) {
            return 'AW';
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
