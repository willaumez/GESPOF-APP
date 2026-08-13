<?php

declare(strict_types=1);

namespace App\Service\ServiceReglement;

interface DashboardServiceInterface
{
    public function resume(): array;

    public function fichesRecentes(): array;
}
