<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Support;

/**
 * Filtres Methods.RecettesImpots — SPEC §5.3.
 */
final class RecettesImpotsFiltres
{
    public const PREFIXES = ['1812', '4781', '4783'];

    public static function prefixeCompte(?string $cIt): string
    {
        $digits = preg_replace('/\D+/', '', (string) $cIt) ?? '';

        return substr($digits, 0, 4);
    }

    public static function estCompteRetenu(?string $cIt): bool
    {
        return in_array(self::prefixeCompte($cIt), self::PREFIXES, true);
    }

    public static function estTransfert(?string $cIt): bool
    {
        return self::prefixeCompte($cIt) === '1812';
    }

    public static function estPriseEnCharge(?string $cIt): bool
    {
        $p = self::prefixeCompte($cIt);

        return $p === '4781' || $p === '4783';
    }

    public static function estPrecompteTva(?string $cIt): bool
    {
        return strtoupper(trim((string) $cIt)) === '1812-211';
    }

    /**
     * C_NOP ∈ {B, N}, ou précompte TVA 1812-211.
     */
    public static function nopRetenu(?string $cNop, ?string $cIt): bool
    {
        if (self::estPrecompteTva($cIt)) {
            return true;
        }
        $nop = strtoupper(trim((string) $cNop));

        return in_array($nop, ['B', 'N'], true);
    }

    /**
     * Prises en charge 4781/4783 sans C_NAT écartées.
     */
    public static function pecAvecNature(?string $cIt, ?string $cNat): bool
    {
        if (!self::estPriseEnCharge($cIt)) {
            return true;
        }

        return trim((string) $cNat) !== '';
    }

    public static function operationRetenue(?string $cIt, ?string $cNop, ?string $cNat): bool
    {
        if (!self::estCompteRetenu($cIt)) {
            return false;
        }
        if (!self::pecAvecNature($cIt, $cNat)) {
            return false;
        }

        return self::nopRetenu($cNop, $cIt);
    }

    /**
     * Code RF — cas particuliers SPEC §5.3.7 (hors table).
     */
    public static function codeRfParticulier(
        ?string $cIt,
        bool $petrole,
        ?string $typePetrole = null,
    ): ?string {
        if (self::estPrecompteTva($cIt)) {
            return 'RF5';
        }
        if ($petrole) {
            $t = strtoupper(trim((string) $typePetrole));

            return match (true) {
                $t === 'IS' => 'RF36',
                str_contains($t, 'DIVID') => 'RF76',
                default => 'RF80',
            };
        }

        return null;
    }
}
