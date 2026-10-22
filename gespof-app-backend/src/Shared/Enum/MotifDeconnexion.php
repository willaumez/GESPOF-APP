<?php

declare(strict_types=1);

namespace App\Shared\Enum;

enum MotifDeconnexion: string
{
    case DECONNEXION = 'DECONNEXION';
    case INACTIVITE = 'INACTIVITE';
    case EXPIRATION = 'EXPIRATION';
    case NOUVELLE_CONNEXION = 'NOUVELLE_CONNEXION';

    public function libelle(): string
    {
        return match ($this) {
            self::DECONNEXION => 'Déconnexion',
            self::INACTIVITE => 'Inactivité',
            self::EXPIRATION => 'Expiration de session',
            self::NOUVELLE_CONNEXION => 'Connexion sur un autre appareil ou navigateur',
        };
    }
}
