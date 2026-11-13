<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Enum;

/**
 * Type de ligne dc_mandat (F4 règlements / F5 RAP).
 */
enum TypeDcMandat: string
{
    case REGLE = 'REGLE';
    case RAP = 'RAP';

    public function libelle(): string
    {
        return match ($this) {
            self::REGLE => 'Règlement',
            self::RAP => 'Reste à payer',
        };
    }
}
