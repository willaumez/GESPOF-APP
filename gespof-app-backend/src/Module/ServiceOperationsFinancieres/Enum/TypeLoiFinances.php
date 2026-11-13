<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Enum;

enum TypeLoiFinances: string
{
    case LFI = 'LFI';
    case LFR = 'LFR';

    public function libelle(int $annee): string
    {
        return sprintf('%s %d', $this->value, $annee);
    }
}
