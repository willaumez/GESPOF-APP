<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Service\Exception;

use App\Shared\Exception\ApiExceptionInterface;
use Symfony\Component\HttpFoundation\Response;

final class PeriodeIntrouvableException extends \RuntimeException implements ApiExceptionInterface
{
    public function getStatusCode(): int
    {
        return Response::HTTP_NOT_FOUND;
    }
}
