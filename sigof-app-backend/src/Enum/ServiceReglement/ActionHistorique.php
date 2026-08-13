<?php

declare(strict_types=1);

namespace App\Enum\ServiceReglement;

enum ActionHistorique: string
{
    case CREEE   = 'creee';
    case ENVOYEE = 'envoyee';
    case RECUE   = 'recue';

    public function libelle(): string
    {
        return match($this) {
            self::CREEE   => 'Créée',
            self::ENVOYEE => 'Envoyée',
            self::RECUE   => 'Reçue',
        };
    }
}
