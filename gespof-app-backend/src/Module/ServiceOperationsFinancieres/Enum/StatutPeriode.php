<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Enum;

/**
 * Statut d'une période mensuelle de production SROT.
 */
enum StatutPeriode: string
{
    case OUVERTE = 'ouverte';
    case EN_CONTROLE = 'en_controle';
    case VALIDEE = 'validee';
    case PUBLIEE = 'publiee';

    public function libelle(): string
    {
        return match ($this) {
            self::OUVERTE => 'Ouverte',
            self::EN_CONTROLE => 'En contrôle',
            self::VALIDEE => 'Validée',
            self::PUBLIEE => 'Publiée',
        };
    }
}
