<?php

declare(strict_types=1);

namespace App\Service\ServiceReglement\Exception;

interface ApiExceptionInterface extends \Throwable
{
    public function getStatusCode(): int;
}
