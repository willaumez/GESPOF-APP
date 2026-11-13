<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Extraction;

enum DomaineExtraction: string
{
    case RECETTES = 'RECETTES';
    case DEPENSES = 'DEPENSES';
    case EXECUTION = 'EXECUTION';

    public function libelle(): string
    {
        return match ($this) {
            self::RECETTES => 'Recettes',
            self::DEPENSES => 'Dépenses',
            self::EXECUTION => 'Exécution',
        };
    }
}
