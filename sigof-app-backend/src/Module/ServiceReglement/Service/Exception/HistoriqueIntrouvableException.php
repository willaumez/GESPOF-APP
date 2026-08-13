<?php

declare(strict_types=1);

namespace App\Module\ServiceReglement\Service\Exception;

use Symfony\Component\HttpFoundation\Response;

class HistoriqueIntrouvableException extends \RuntimeException implements ApiExceptionInterface
{
    public function getStatusCode(): int
    {
        return Response::HTTP_NOT_FOUND;
    }
}
