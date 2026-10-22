<?php

declare(strict_types=1);

namespace App\Shared\Exception;

use Symfony\Component\HttpFoundation\Response;

class NotificationIntrouvableException extends \RuntimeException implements ApiExceptionInterface
{
    public function getStatusCode(): int
    {
        return Response::HTTP_NOT_FOUND;
    }
}
