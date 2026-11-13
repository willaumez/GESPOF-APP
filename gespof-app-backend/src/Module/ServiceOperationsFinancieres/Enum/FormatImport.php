<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Enum;

/**
 * Formats d'import SOF (F1 à F14 — cadre commun / plan phase 1).
 */
enum FormatImport: string
{
    case F1 = 'F1';
    case F2 = 'F2';
    case F3 = 'F3';
    case F4 = 'F4';
    case F5 = 'F5';
    case F6 = 'F6';
    case F7 = 'F7';
    case F8 = 'F8';
    case F9 = 'F9';
    case F10 = 'F10';
    case F11 = 'F11';
    case F12 = 'F12';
    case F13 = 'F13';
    case F14 = 'F14';

    public function libelle(): string
    {
        return match ($this) {
            self::F1 => 'Opérations IG VIDR (F1)',
            self::F2 => 'Règlements sur ordonnances (DC · XRGV)',
            self::F3 => 'Ordonnances visées (DC · XLOP)',
            self::F4 => 'Règlements TVA (DC · XRGM)',
            self::F5 => 'RAP TVA (DC · XRAM)',
            self::F6 => 'Crédits délégués (DC · CDEL)',
            self::F7 => 'Récapitulatif BEAC (IG)',
            self::F8 => 'RUSID 4663-218 (MCPT)',
            self::F9 => 'Avances au budget (IG)',
            self::F10 => 'Correspondants (DSI)',
            self::F11 => 'Comptes douanes (legacy)',
            self::F12 => 'État DRPHP (pétrole / douanes · hebdo / mensuel)',
            self::F13 => 'Recettes fiscales (IG)',
            self::F14 => 'Correspondants / services',
        };
    }

    public function origine(): string
    {
        return match ($this) {
            self::F2, self::F3, self::F4, self::F5, self::F6 => 'DC',
            self::F1, self::F7, self::F8, self::F9, self::F11, self::F12, self::F13 => 'IG',
            self::F10, self::F14 => 'Service',
        };
    }
}
