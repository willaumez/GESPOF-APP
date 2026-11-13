<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Enum;

/**
 * Domaine de rapprochement DOMF / externe (DRPHP).
 */
enum DomaineRapprochement: string
{
    case PETROLE = 'PETROLE';
    case DOUANE = 'DOUANE';

    public function libelle(): string
    {
        return match ($this) {
            self::PETROLE => 'Pétrole',
            self::DOUANE => 'Douanes',
        };
    }
}
