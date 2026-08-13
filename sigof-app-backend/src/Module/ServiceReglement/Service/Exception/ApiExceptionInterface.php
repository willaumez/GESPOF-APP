<?php

declare(strict_types=1);

namespace App\Module\ServiceReglement\Service\Exception;

interface ApiExceptionInterface extends \Throwable
{
    public function getStatusCode(): int;
}
