<?php

declare(strict_types=1);

namespace App\Module\ServiceReglement\Service;

interface DashboardServiceInterface
{
    public function resume(): array;

    public function fichesRecentes(): array;
}
