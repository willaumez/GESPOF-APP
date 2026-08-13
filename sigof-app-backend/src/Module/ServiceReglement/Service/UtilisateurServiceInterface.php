<?php

declare(strict_types=1);

namespace App\Module\ServiceReglement\Service;

use App\Shared\Model\Utilisateur;

interface UtilisateurServiceInterface
{
    public function lister(string $search, ?string $role, ?string $statut, int $page, string $limitRaw): array;

    public function detail(int $id): array;

    public function creer(array $data): array;

    public function modifier(int $id, array $data): array;

    public function desactiver(int $id): void;

    public function reactiver(int $id): void;

    public function reinitialiserMotDePasse(int $id): array;

    public function supprimer(int $id, Utilisateur $utilisateurConnecte): void;
}
