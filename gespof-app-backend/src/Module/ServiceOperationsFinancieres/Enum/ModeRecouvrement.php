<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Enum;

/**
 * Mode de recouvrement des recettes fiscales (DGI).
 */
enum ModeRecouvrement: string
{
    case ETAX = 'ETAX';
    case SWIFT = 'SWIFT';
    case NUMERAIRE = 'NUMERAIRE';
    case BANCAIRE = 'BANCAIRE';

    public function libelle(): string
    {
        return match ($this) {
            self::ETAX => 'e-Tax',
            self::SWIFT => 'SWIFT',
            self::NUMERAIRE => 'Numéraire',
            self::BANCAIRE => 'Bancaire',
        };
    }
}
