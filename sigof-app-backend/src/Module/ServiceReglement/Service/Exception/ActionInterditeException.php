<?php

declare(strict_types=1);

namespace App\Module\ServiceReglement\Service\Exception;

use Symfony\Component\HttpFoundation\Response;

class ActionInterditeException extends \RuntimeException implements ApiExceptionInterface
{
    public function getStatusCode(): int
    {
        return Response::HTTP_FORBIDDEN;
    }
}
