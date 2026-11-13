<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Enum;

enum NatureAjustement: string
{
    case RECETTE = 'RECETTE';
    case DEPENSE = 'DEPENSE';

    public function libelle(): string
    {
        return match ($this) {
            self::RECETTE => 'Recette',
            self::DEPENSE => 'Dépense',
        };
    }
}
