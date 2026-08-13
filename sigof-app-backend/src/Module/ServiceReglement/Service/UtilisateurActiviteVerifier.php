<?php

declare(strict_types=1);

namespace App\Module\ServiceReglement\Service;

use App\Module\ServiceReglement\Repository\FicheDepotRepository;
use App\Module\ServiceReglement\Repository\HistoriqueFicheRepository;
use App\Shared\Service\UtilisateurActiviteVerifierInterface;

final class UtilisateurActiviteVerifier implements UtilisateurActiviteVerifierInterface
{
    public function __construct(
        private readonly FicheDepotRepository $ficheDepotRepository,
        private readonly HistoriqueFicheRepository $historiqueFicheRepository,
    ) {
    }

    public function aDeLActivite(int $utilisateurId): bool
    {
        return $this->ficheDepotRepository->countByUtilisateur($utilisateurId) > 0
            || $this->historiqueFicheRepository->countByUtilisateur($utilisateurId) > 0;
    }
}
