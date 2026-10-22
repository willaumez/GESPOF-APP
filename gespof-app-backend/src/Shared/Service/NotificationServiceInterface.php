<?php

declare(strict_types=1);

namespace App\Shared\Service;

use App\Shared\Entite\Utilisateur;

interface NotificationServiceInterface
{
    /**
     * @return array{non_lues: int, notifications: list<array<string, mixed>>}
     */
    public function listerPourUtilisateur(string $portail, Utilisateur $utilisateur): array;

    /**
     * @return array{non_lues: int, notifications: list<array<string, mixed>>}
     */
    public function marquerLue(int $id, string $portail, Utilisateur $utilisateur): array;

    /**
     * @return array{non_lues: int, notifications: list<array<string, mixed>>}
     */
    public function marquerToutesLues(string $portail, Utilisateur $utilisateur): array;

    /**
     * @param array<string, mixed>|null $donnees
     */
    public function creer(
        string $portail,
        string $type,
        string $titre,
        string $message,
        ?string $cibleType = null,
        ?string $cibleReference = null,
        ?string $lien = null,
        ?array $donnees = null,
        bool $flush = false,
    ): void;

    public function existePourCible(
        string $portail,
        string $type,
        string $cibleType,
        string $cibleReference,
    ): bool;
}
