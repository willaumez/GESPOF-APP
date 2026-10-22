<?php

declare(strict_types=1);

namespace App\Module\ServicePrevision\Enum;

/**
 * Nature métier d'une section (bibliothèque, Fiche Bleue, Fiche d'exécution) :
 * SOLDE (soldes bancaires d'entrée / d'ouverture), RECETTE ou DEPENSE.
 *
 * Une Fiche Bleue et une Fiche d'exécution n'admettent chacune qu'une seule
 * section racine SOLDE (en-tête obligatoire). La bibliothèque peut en contenir plusieurs.
 */
enum TypeSection: string
{
    case SOLDE   = 'solde';
    case RECETTE = 'recette';
    case DEPENSE = 'depense';

    public function libelle(): string
    {
        return match ($this) {
            self::SOLDE   => 'Solde',
            self::RECETTE => 'Recette',
            self::DEPENSE => 'Dépense',
        };
    }

    /** @return list<string> */
    public static function valeurs(): array
    {
        return array_column(self::cases(), 'value');
    }
}
