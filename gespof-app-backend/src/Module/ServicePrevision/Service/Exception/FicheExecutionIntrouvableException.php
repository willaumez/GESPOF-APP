<?php

declare(strict_types=1);

namespace App\Module\ServicePrevision\Service\Exception;

use App\Shared\Exception\ApiExceptionInterface;

final class FicheExecutionIntrouvableException extends \RuntimeException implements ApiExceptionInterface
{
    public function getStatusCode(): int
    {
        return \Symfony\Component\HttpFoundation\Response::HTTP_NOT_FOUND;
    }
}
