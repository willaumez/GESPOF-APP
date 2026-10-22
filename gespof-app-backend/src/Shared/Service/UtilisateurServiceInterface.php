<?php

declare(strict_types=1);

namespace App\Shared\Service;

use App\Shared\Entite\Utilisateur;

interface UtilisateurServiceInterface
{
    public function lister(Utilisateur $utilisateurConnecte, string $search, ?string $role, ?string $statut, int $page, string $limitRaw, ?string $portail = null, ?string $dateDebut = null, ?string $dateFin = null): array;

    public function detail(Utilisateur $utilisateurConnecte, int $id): array;

    public function creer(Utilisateur $utilisateurConnecte, array $data): array;

    public function modifier(Utilisateur $utilisateurConnecte, int $id, array $data): array;

    public function desactiver(Utilisateur $utilisateurConnecte, int $id): void;

    public function reactiver(Utilisateur $utilisateurConnecte, int $id): void;

    public function reinitialiserMotDePasse(Utilisateur $utilisateurConnecte, int $id): array;

    public function supprimer(Utilisateur $utilisateurConnecte, int $id): void;
}
