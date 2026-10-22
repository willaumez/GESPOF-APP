<?php

declare(strict_types=1);

namespace App\Module\ServicePrevision\Enum;

/**
 * Statuts partagés par la Fiche Bleue et la Fiche d'exécution.
 *
 * Transitions liées à la Journée de trésorerie (à brancher plus tard) :
 * - Fiche Bleue : BROUILLON à la création → EN_COURS lorsqu'elle est liée
 *   à une JournéeTresorerie → CLOTURE lorsque cette journée est clôturée.
 * - Fiche d'exécution : EN_COURS à la création → CLOTURE à la clôture
 *   de la JournéeTresorerie.
 */
enum StatutFiche: string
{
    case BROUILLON = 'brouillon';
    case VALIDE    = 'valide';
    case EN_COURS  = 'en_cours';
    case CLOTURE   = 'cloture';

    public function libelle(): string
    {
        return match ($this) {
            self::BROUILLON => 'Brouillon',
            self::VALIDE    => 'Validée',
            self::EN_COURS  => 'En cours',
            self::CLOTURE   => 'Clôturée',
        };
    }
}
