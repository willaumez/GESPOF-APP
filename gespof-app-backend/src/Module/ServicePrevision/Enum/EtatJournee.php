<?php

declare(strict_types=1);

namespace App\Module\ServicePrevision\Enum;

/**
 * État d'une Journée de trésorerie.
 * BROUILLON à la création (sans fiches liées) → EN_COURS lorsque la journée
 * est active / liée aux fiches → CLOTURE à la clôture (propage CLOTURE aux
 * FicheBleue / FicheExecution liées).
 */
enum EtatJournee: string
{
    case BROUILLON = 'brouillon';
    case EN_COURS  = 'en_cours';
    case CLOTURE   = 'cloture';

    public function libelle(): string
    {
        return match ($this) {
            self::BROUILLON => 'Brouillon',
            self::EN_COURS  => 'En cours',
            self::CLOTURE   => 'Clôturée',
        };
    }
}
