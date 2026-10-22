<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Enum;

/**
 * Nature d'une rubrique de dépense SOF (nomenclature budgétaire).
 */
enum NatureDepense: string
{
    case EX_ANTERIEUR = 'ex_anterieur';
    case EXERCICE_COURANT = 'exercice_courant';
    case SANS_ORDONNANCEMENT = 'sans_ordonnancement';

    public function libelle(): string
    {
        return match ($this) {
            self::EX_ANTERIEUR => 'Exercice antérieur',
            self::EXERCICE_COURANT => 'Exercice courant',
            self::SANS_ORDONNANCEMENT => 'Sans ordonnancement',
        };
    }
}
