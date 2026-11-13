<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Enum;

/**
 * Type de recette pétrolière pour la qualification des transferts 1812-201.
 */
enum TypeRecetteTransfert: string
{
    case IS = 'IS';
    case DIVIDENDES = 'DIVIDENDES';
    case RMP = 'RMP';
    case REDEVANCE_SUP = 'REDEVANCE_SUP';
    case PROFIT_OIL = 'PROFIT_OIL';
    case DISCOUNT_BONI = 'DISCOUNT_BONI';
    case PIPES = 'PIPES';
    case NON_QUALIFIE = 'NON_QUALIFIE';
    case NA = 'N/A';

    public function libelle(): string
    {
        return match ($this) {
            self::IS => 'IS',
            self::DIVIDENDES => 'Dividendes',
            self::RMP => 'RMP',
            self::REDEVANCE_SUP => 'Redevance superficiaire',
            self::PROFIT_OIL => 'Profit oil',
            self::DISCOUNT_BONI => 'Discount et boni',
            self::PIPES => 'PIPES',
            self::NON_QUALIFIE => 'Non qualifié',
            self::NA => 'N/A',
        };
    }

    /** Rubrique SROT (SPEC §5.1) : IS→103, RMP→261, RS→263, DIV→211, PO→262, bonus→264, pipes→266. */
    public function rubriqueCode(): ?string
    {
        return match ($this) {
            self::IS => '103',
            self::DIVIDENDES => '211',
            self::RMP => '261',
            self::REDEVANCE_SUP => '263',
            self::PROFIT_OIL => '262',
            self::DISCOUNT_BONI => '264',
            self::PIPES => '266',
            self::NON_QUALIFIE, self::NA => null,
        };
    }

    public function consolider(): bool
    {
        return $this->rubriqueCode() !== null;
    }
}
