<?php

declare(strict_types=1);

namespace App\Service\ServiceReglement\Exception;

use Symfony\Component\HttpFoundation\Response;

class FicheIntrouvableException extends \RuntimeException implements ApiExceptionInterface
{
    public function getStatusCode(): int
    {
        return Response::HTTP_NOT_FOUND;
    }
}
