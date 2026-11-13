<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Support\Flechage;

use App\Module\ServiceOperationsFinancieres\Support\ClassementCreditDelegue;

/**
 * Fléchage crédits délégués — SPEC §6.3.
 */
final class CreditsDelegues
{
    /**
     * @return array{
     *   code: string,
     *   titre: int,
     *   type_exercice: string,
     *   nature: int,
     *   anomalie: ?string,
     *   motif: ?string
     * }
     */
    public static function classer(
        ?string $cRef1,
        ?string $cRef2,
        ?string $cNop,
        int $prefixeAd,
    ): array {
        $cNop = strtoupper(trim((string) $cNop));
        if ($cNop === 'R') {
            return [
                'code' => '',
                'titre' => 0,
                'type_exercice' => ClassementCreditDelegue::TYPE_ARRIERE,
                'nature' => 0,
                'anomalie' => null,
                'motif' => 'C_NOP_R',
            ];
        }

        $classement = ClassementCreditDelegue::classer($cRef1, $prefixeAd);
        $type = $classement['type_exercice'];
        $nature = self::natureDepuisRef2($cRef2);
        $titre = TitreAb::titre($nature, true);

        $code = '';
        $motif = null;
        if (in_array($cNop, ['N', 'B'], true)) {
            $code = $type === ClassementCreditDelegue::TYPE_COURANT ? 'AI' : 'D1';
        } else {
            $motif = 'C_NOP_HORS_NB';
        }

        return [
            'code' => $code,
            'titre' => $titre,
            'type_exercice' => $type,
            'nature' => $nature,
            'anomalie' => $classement['anomalie'],
            'motif' => $motif,
        ];
    }

    public static function natureDepuisRef2(?string $cRef2): int
    {
        $brut = preg_replace('/\D+/', '', (string) $cRef2) ?? '';
        if ($brut === '') {
            return 0;
        }
        if (strlen($brut) > 6) {
            $brut = substr($brut, -6);
        }

        return (int) $brut;
    }
}
