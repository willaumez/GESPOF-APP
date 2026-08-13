<?php

declare(strict_types=1);

namespace App\Service\ServiceReglement;

use App\Service\ServiceReglement\Exception\DateInvalideException;
use App\Service\ServiceReglement\Exception\HistoriqueIntrouvableException;

interface HistoriqueServiceInterface
{
    public function lister(?string $dateDebut, ?string $dateFin, ?int $utilisateurId, int $page, string $limitRaw): array;

    public function supprimer(int $id): void;
}
