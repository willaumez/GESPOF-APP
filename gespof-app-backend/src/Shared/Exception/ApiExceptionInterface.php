<?php

declare(strict_types=1);

namespace App\Shared\Exception;

interface ApiExceptionInterface extends \Throwable
{
    public function getStatusCode(): int;
}
