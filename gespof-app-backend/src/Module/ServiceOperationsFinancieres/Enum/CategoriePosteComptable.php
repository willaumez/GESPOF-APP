<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Enum;

/**
 * Catégorie d'un poste comptable du réseau du Trésor.
 */
enum CategoriePosteComptable: string
{
    case TPG = 'TPG';
    case AGC = 'AGC';
    case ENT = 'ENT';

    public function libelle(): string
    {
        return match ($this) {
            self::TPG => 'TPG',
            self::AGC => 'AGC',
            self::ENT => 'ENT',
        };
    }
}
