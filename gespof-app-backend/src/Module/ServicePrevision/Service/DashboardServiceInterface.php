<?php

declare(strict_types=1);

namespace App\Module\ServicePrevision\Service;

interface DashboardServiceInterface
{
    /**
     * Tableau de bord de la journée de trésorerie.
     * $referenceJournee (JT-jj-mm-aaaa-nnn) : cette journée précise (sélection TopBar) ;
     * sinon $dateIso (YYYY-MM-DD) : journée de ce jour calendaire ; sinon journée du jour.
     *
     * @return array<string, mixed>
     */
    public function resume(?string $dateIso = null, ?string $referenceJournee = null): array;
}
