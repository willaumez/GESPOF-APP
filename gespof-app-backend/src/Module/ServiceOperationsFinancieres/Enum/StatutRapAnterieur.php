<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Enum;

enum StatutRapAnterieur: string
{
    case ARRIERE = 'ARRIERE';
    case INSTANCE = 'INSTANCE';

    public function libelle(): string
    {
        return match ($this) {
            self::ARRIERE => 'Arriéré',
            self::INSTANCE => 'Instance',
        };
    }
}
