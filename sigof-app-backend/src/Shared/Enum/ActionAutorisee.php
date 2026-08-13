<?php

declare(strict_types=1);

namespace App\Shared\Enum;

enum ActionAutorisee: string
{
    case CONSULTER = 'CONSULTER';
    case AJOUTER = 'AJOUTER';
    case MODIFIER = 'MODIFIER';
    case SUPPRIMER = 'SUPPRIMER';

    public function libelle(): string
    {
        return match ($this) {
            self::CONSULTER => 'Consulter',
            self::AJOUTER => 'Ajouter',
            self::MODIFIER => 'Modifier',
            self::SUPPRIMER => 'Supprimer',
        };
    }
}
