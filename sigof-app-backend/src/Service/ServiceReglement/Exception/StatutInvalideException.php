<?php

declare(strict_types=1);

namespace App\Service\ServiceReglement\Exception;

use Symfony\Component\HttpFoundation\Response;

class StatutInvalideException extends \InvalidArgumentException implements ApiExceptionInterface
{
    public function getStatusCode(): int
    {
        return Response::HTTP_BAD_REQUEST;
    }
}
