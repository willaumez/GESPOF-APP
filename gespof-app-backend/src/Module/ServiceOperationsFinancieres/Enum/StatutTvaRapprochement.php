<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Enum;

/**
 * Statut d'un mandat TVA rapproché : arriéré (exercice antérieur) ou courant.
 */
enum StatutTvaRapprochement: string
{
    case ARRIERE = 'ARRIERE';
    case COURANT = 'COURANT';

    public function libelle(): string
    {
        return match ($this) {
            self::ARRIERE => 'Arriéré',
            self::COURANT => 'Courant',
        };
    }
}
