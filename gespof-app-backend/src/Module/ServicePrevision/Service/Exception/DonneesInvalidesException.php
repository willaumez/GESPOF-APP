<?php

declare(strict_types=1);

namespace App\Module\ServicePrevision\Service\Exception;

use App\Shared\Exception\ApiExceptionInterface;
use Symfony\Component\HttpFoundation\Response;

class DonneesInvalidesException extends \InvalidArgumentException implements ApiExceptionInterface
{
    public function getStatusCode(): int
    {
        return Response::HTTP_BAD_REQUEST;
    }
}
