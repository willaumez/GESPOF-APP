<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Enum;

/**
 * Mois de l'année (1 à 12).
 */
enum Mois: int
{
    case JANVIER = 1;
    case FEVRIER = 2;
    case MARS = 3;
    case AVRIL = 4;
    case MAI = 5;
    case JUIN = 6;
    case JUILLET = 7;
    case AOUT = 8;
    case SEPTEMBRE = 9;
    case OCTOBRE = 10;
    case NOVEMBRE = 11;
    case DECEMBRE = 12;

    public function libelle(): string
    {
        return match ($this) {
            self::JANVIER => 'janvier',
            self::FEVRIER => 'février',
            self::MARS => 'mars',
            self::AVRIL => 'avril',
            self::MAI => 'mai',
            self::JUIN => 'juin',
            self::JUILLET => 'juillet',
            self::AOUT => 'août',
            self::SEPTEMBRE => 'septembre',
            self::OCTOBRE => 'octobre',
            self::NOVEMBRE => 'novembre',
            self::DECEMBRE => 'décembre',
        };
    }
}
