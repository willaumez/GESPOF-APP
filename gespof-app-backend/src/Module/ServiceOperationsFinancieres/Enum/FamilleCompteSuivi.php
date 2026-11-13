<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Enum;

/**
 * Famille d'un compte de suivi (douanes / pétrole).
 */
enum FamilleCompteSuivi: string
{
    case DOUANE = 'DOUANE';
    case PETROLE = 'PETROLE';

    public function libelle(): string
    {
        return match ($this) {
            self::DOUANE => 'Douane',
            self::PETROLE => 'Pétrole',
        };
    }
}
