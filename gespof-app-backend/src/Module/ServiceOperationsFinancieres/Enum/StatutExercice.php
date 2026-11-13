<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Enum;

/**
 * Statut d'un exercice budgétaire SOF.
 */
enum StatutExercice: string
{
    case OUVERT = 'ouvert';
    case CLOTURE = 'cloture';

    public function libelle(): string
    {
        return match ($this) {
            self::OUVERT => 'Ouvert',
            self::CLOTURE => 'Clôturé',
        };
    }
}
