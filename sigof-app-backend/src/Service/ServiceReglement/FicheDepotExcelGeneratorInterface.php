<?php

declare(strict_types=1);

namespace App\Service\ServiceReglement;

use App\Entity\ServiceReglement\FicheDepot;

interface FicheDepotExcelGeneratorInterface
{
    public function genererFichier(FicheDepot $fiche): array;
}
