<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Support;

/**
 * Arithmétique monétaire SOF : bcmath uniquement, jamais de float.
 * Les montants sont des chaînes (decimal 15,2).
 */
final class Montant
{
    public const ECHELLE = 2;

    public static function normaliser(string $valeur): string
    {
        if (!is_numeric($valeur)) {
            throw new \InvalidArgumentException(sprintf('Montant invalide : "%s".', $valeur));
        }

        return bcadd($valeur, '0', self::ECHELLE);
    }

    public static function additionner(string $gauche, string $droite): string
    {
        return bcadd(self::normaliser($gauche), self::normaliser($droite), self::ECHELLE);
    }
}
