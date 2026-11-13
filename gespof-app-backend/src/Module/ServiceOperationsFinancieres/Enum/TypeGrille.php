<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Enum;

enum TypeGrille: string
{
    case PLAN_DGI = 'PLAN_DGI';
    case PLAN_DGH = 'PLAN_DGH';
    case PLAN_DGDDI = 'PLAN_DGDDI';
    case PLAN_DETTE = 'PLAN_DETTE';
    case PLAN_TITRES = 'PLAN_TITRES';

    public function libelle(): string
    {
        return match ($this) {
            self::PLAN_DGI => 'Plan de trésorerie DGI',
            self::PLAN_DGH => 'Plan de trésorerie DGH',
            self::PLAN_DGDDI => 'Plan de trésorerie DGDDI',
            self::PLAN_DETTE => 'Service de la dette (DGD)',
            self::PLAN_TITRES => 'Programme d\'émission des titres',
        };
    }

    /** Unité d'import source (stockage toujours FCFA). */
    public function uniteImportDefaut(): string
    {
        return match ($this) {
            self::PLAN_DGI, self::PLAN_DGH, self::PLAN_DETTE, self::PLAN_TITRES => 'MILLIONS',
            self::PLAN_DGDDI => 'FCFA',
        };
    }
}
