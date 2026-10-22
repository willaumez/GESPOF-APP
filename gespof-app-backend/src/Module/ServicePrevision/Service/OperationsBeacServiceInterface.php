<?php

declare(strict_types=1);

namespace App\Module\ServicePrevision\Service;

interface OperationsBeacServiceInterface
{
    /** @return array{dates: list<array<string, mixed>>, message: string|null} */
    public function listerDatesOuverture(): array;

    /**
     * @return array{
     *     date: string,
     *     operations: list<array<string, mixed>>,
     *     total: string,
     *     nombre: int,
     *     page: int,
     *     pages: int,
     *     limite: int|string,
     *     origines: list<string>,
     *     message: string|null
     * }
     */
    public function listerRecettes(
        string $dateOuverture,
        ?string $recherche = null,
        ?string $origine = null,
        int $page = 1,
        int|string $limite = 15,
    ): array;
}
