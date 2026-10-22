<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Enum;

/**
 * Famille de compte douanier du modèle automatisé SOF.
 */
enum TypeCompteDouane: string
{
    case DOUANE_A_CREDIT = 'DOUANE_A_CREDIT';
    case DOUANE_AU_COMPTANT = 'DOUANE_AU_COMPTANT';
    case DOUANE_MANUELLE = 'DOUANE_MANUELLE';
    case RUSID = 'RUSID';
    case COMPTE_DE_TRANSFERT = 'COMPTE_DE_TRANSFERT';

    public function libelle(): string
    {
        return match ($this) {
            self::DOUANE_A_CREDIT => 'DOUANE A CRÉDIT',
            self::DOUANE_AU_COMPTANT => 'DOUANE AU COMPTANT',
            self::DOUANE_MANUELLE => 'DOUANE MANUELLE',
            self::RUSID => 'RUSID',
            self::COMPTE_DE_TRANSFERT => 'COMPTE DE TRANSFERT',
        };
    }

    public function libelleTotal(): string
    {
        return match ($this) {
            self::DOUANE_A_CREDIT => 'Total Douane à Crédit',
            self::DOUANE_AU_COMPTANT => 'Total Douane au Comptant',
            self::DOUANE_MANUELLE => 'Total Douane Manuelle',
            self::RUSID => 'Total RUSID',
            self::COMPTE_DE_TRANSFERT => 'Total Compte de Transfert',
        };
    }

    /** Ordre d'affichage = ordre de déclaration des cas. */
    public function ordre(): int
    {
        return (int) array_search($this, self::cases(), true) + 1;
    }
}
