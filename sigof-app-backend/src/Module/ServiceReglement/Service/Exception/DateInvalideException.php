<?php

declare(strict_types=1);

namespace App\Module\ServiceReglement\Service\Exception;

use Symfony\Component\HttpFoundation\Response;

class DateInvalideException extends \InvalidArgumentException implements ApiExceptionInterface
{
    public function getStatusCode(): int
    {
        return Response::HTTP_BAD_REQUEST;
    }
}
