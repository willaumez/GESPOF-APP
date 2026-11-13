<?php

declare(strict_types=1);

namespace App\Shared\Enum;

/**
 * Genre d'un utilisateur : stocké ; la civilité (M. / Mme) en est dérivée et n'est jamais enregistrée.
 */
enum Genre: string
{
    case Homme = 'homme';
    case Femme = 'femme';

    public function libelle(): string
    {
        return match ($this) {
            self::Homme => 'Homme',
            self::Femme => 'Femme',
        };
    }

    /** Civilité pour les salutations : « M. » / « Mme ». */
    public function civilite(): string
    {
        return match ($this) {
            self::Homme => 'M.',
            self::Femme => 'Mme',
        };
    }
}
