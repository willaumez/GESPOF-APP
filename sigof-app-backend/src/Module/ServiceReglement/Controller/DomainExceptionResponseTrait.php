<?php

declare(strict_types=1);

namespace App\Module\ServiceReglement\Controller;

use App\Module\ServiceReglement\Service\Exception\ApiExceptionInterface;
use Symfony\Component\HttpFoundation\JsonResponse;

trait DomainExceptionResponseTrait
{
    private function run(callable $action): JsonResponse
    {
        try {
            return $action();
        } catch (ApiExceptionInterface $e) {
            return new JsonResponse(['message' => $e->getMessage()], $e->getStatusCode());
        }
    }
}
