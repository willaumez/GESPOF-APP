<?php

declare(strict_types=1);

namespace App\Module\ServicePrevision\Service;

interface FicheBleueModeleServiceInterface
{
    public function lister(?string $recherche = null): array;

    public function detail(int $id): array;

    public function listerCatalogueSections(): array;

    public function creer(array $donnees): array;

    public function modifier(int $id, array $donnees): array;

    public function supprimer(int $id): void;
}
