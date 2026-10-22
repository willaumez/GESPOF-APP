<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Enum;

/**
 * Section du plan de comptes des recettes SOF (nomenclature budgétaire).
 */
enum SectionRecette: string
{
    case PETROLE = 'petrole';
    case RECETTES_FISCALES = 'recettes_fiscales';
    case RECETTES_NON_FISCALES = 'recettes_non_fiscales';
    case RECETTES_AFFECTEES = 'recettes_affectees';
    case EMPRUNT = 'emprunt';
    case NON_BUDGETAIRE = 'non_budgetaire';

    public function libelle(): string
    {
        return match ($this) {
            self::PETROLE => 'Pétrole',
            self::RECETTES_FISCALES => 'Recettes fiscales',
            self::RECETTES_NON_FISCALES => 'Recettes non fiscales',
            self::RECETTES_AFFECTEES => 'Recettes affectées',
            self::EMPRUNT => 'Emprunt',
            self::NON_BUDGETAIRE => 'Non budgétaire',
        };
    }
}
