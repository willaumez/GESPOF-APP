<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Enum;

/**
 * Checklist « Points d'attention » (annexe SROT — maquette SOF).
 */
enum PointAttentionCode: string
{
    case BOURSES = 'bourses';
    case FONDS_DIVERS = 'fonds_divers';
    case PRIMES = 'primes';
    case DETTE = 'dette';
    case DTS = 'dts';
    case VARIATIONS = 'variations';
    case POINTAGE = 'pointage';
    case RECETTES_AFFECTEES = 'recettes_affectees';
    case EXECUTION_PREVISION = 'execution_prevision';

    public function libelle(): string
    {
        return match ($this) {
            self::BOURSES => 'Bourses',
            self::FONDS_DIVERS => 'Fonds divers',
            self::PRIMES => 'Primes',
            self::DETTE => 'Dette',
            self::DTS => 'DTS',
            self::VARIATIONS => 'Variations',
            self::POINTAGE => 'Pointage',
            self::RECETTES_AFFECTEES => 'Recettes affectées',
            self::EXECUTION_PREVISION => 'Exécution de la prévision',
        };
    }

    public function sousTitre(): string
    {
        return match ($this) {
            self::BOURSES => 'Bourses réglées rapprochées de l\'état de la DGBEE',
            self::FONDS_DIVERS => 'Fonds divers ventilés par bénéficiaire',
            self::PRIMES => 'Primes et indemnités imputées en personnel',
            self::DETTE => 'Service de la dette conforme à l\'état DGD',
            self::DTS => 'Allocations DTS comptabilisées',
            self::VARIATIONS => 'Variations > seuil commentées',
            self::POINTAGE => 'Pointage BEAC du compte unique',
            self::RECETTES_AFFECTEES => 'Recettes affectées reversées aux bénéficiaires',
            self::EXECUTION_PREVISION => 'Exécution comparée au plan de trésorerie',
        };
    }
}
