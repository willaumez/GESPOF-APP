<?php

declare(strict_types=1);

namespace App\Enum\ServiceReglement;

enum StatutFiche: string
{
    case CREE    = 'cree';
    case ENVOYEE = 'envoyee';
    case RECUE   = 'recue';

    public function libelle(): string
    {
        return match($this) {
            self::CREE    => 'Créée',
            self::ENVOYEE => 'Envoyée',
            self::RECUE   => 'Reçue',
        };
    }
}

