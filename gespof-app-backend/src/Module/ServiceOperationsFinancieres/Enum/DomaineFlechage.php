<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Enum;

/**
 * Domaine d'application d'une règle de fléchage.
 */
enum DomaineFlechage: string
{
    case CORRESP_RECETTE = 'corresp_recette';
    case CORRESP_DEPENSE = 'corresp_depense';
    case AVANCE = 'avance';
    case REGLEMENT = 'reglement';
    case CREDIT_DELEGUE = 'credit_delegue';

    public function libelle(): string
    {
        return match ($this) {
            self::CORRESP_RECETTE => 'Correspondants · recettes',
            self::CORRESP_DEPENSE => 'Correspondants · dépenses',
            self::AVANCE => 'Avances au budget',
            self::REGLEMENT => 'Règlements sur ordonnances',
            self::CREDIT_DELEGUE => 'Crédits délégués',
        };
    }

    /** Onglet maquette associé. */
    public function onglet(): string
    {
        return match ($this) {
            self::CORRESP_RECETTE, self::CORRESP_DEPENSE => 'corr',
            self::AVANCE => 'av',
            self::REGLEMENT => 'ord',
            self::CREDIT_DELEGUE => 'cd',
        };
    }
}
