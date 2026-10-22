<?php

declare(strict_types=1);

namespace App\Shared\Enum;

enum Portail: string
{
    case SOF = 'SOF';
    case SP = 'SP';
    case SR = 'SR';
    case ADMIN = 'ADMIN';

    public function libelle(): string
    {
        return match ($this) {
            self::SOF => 'Service des Opérations Financières',
            self::SP => 'Service de Prévision',
            self::SR => 'Service Règlement',
            self::ADMIN => 'Administration',
        };
    }
}
