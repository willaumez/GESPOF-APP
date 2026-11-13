<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Enum;

/**
 * Statut d'un lot d'import.
 */
enum StatutLotImport: string
{
    case ACTIF = 'ACTIF';
    case REMPLACE = 'REMPLACE';
    case ANNULE = 'ANNULE';

    public function libelle(): string
    {
        return match ($this) {
            self::ACTIF => 'Actif',
            self::REMPLACE => 'Remplacé',
            self::ANNULE => 'Annulé',
        };
    }
}
