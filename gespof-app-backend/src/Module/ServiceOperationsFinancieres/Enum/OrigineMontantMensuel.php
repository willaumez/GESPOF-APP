<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Enum;

enum OrigineMontantMensuel: string
{
    case AUTO = 'AUTO';
    case MANUEL = 'MANUEL';
    case AJUSTEMENT = 'AJUSTEMENT';

    public function libelle(): string
    {
        return match ($this) {
            self::AUTO => 'Automatique',
            self::MANUEL => 'Manuel',
            self::AJUSTEMENT => 'Ajustement',
        };
    }
}
