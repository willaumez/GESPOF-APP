<?php

declare(strict_types=1);

namespace App\Module\ServiceReglement\Service;

use App\Module\ServiceReglement\Service\Exception\DateInvalideException;
use App\Module\ServiceReglement\Service\Exception\HistoriqueIntrouvableException;

interface HistoriqueServiceInterface
{
    public function lister(?string $dateDebut, ?string $dateFin, ?int $utilisateurId, int $page, string $limitRaw): array;

    public function supprimer(int $id): void;
}
