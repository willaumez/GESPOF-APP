<?php

declare(strict_types=1);

namespace App\Module\ServiceReglement\Service;

use App\Module\ServiceReglement\Model\FicheDepot;

interface FicheDepotExcelGeneratorInterface
{
    public function genererFichier(FicheDepot $fiche): array;
}
