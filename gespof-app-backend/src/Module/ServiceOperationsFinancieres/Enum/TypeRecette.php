<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Enum;

/**
 * Type de recette SOF : valeur du discriminant de la table sof_recette.
 */
enum TypeRecette: string
{
    case PETROLIERE = 'PETROLIERE';
    case FISCALE = 'FISCALE';
    case DOUANIERE = 'DOUANIERE';

    public function libelle(): string
    {
        return match ($this) {
            self::PETROLIERE => 'Recettes pétrolières',
            self::FISCALE => 'Recettes fiscales',
            self::DOUANIERE => 'Recettes douanières',
        };
    }
}
