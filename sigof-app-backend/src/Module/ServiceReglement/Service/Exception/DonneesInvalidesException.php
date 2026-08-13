<?php

declare(strict_types=1);

namespace App\Module\ServiceReglement\Service\Exception;

use Symfony\Component\HttpFoundation\Response;

class DonneesInvalidesException extends \RuntimeException implements ApiExceptionInterface
{
    public function getStatusCode(): int
    {
        return Response::HTTP_BAD_REQUEST;
    }
}
