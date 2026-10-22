<?php

declare(strict_types=1);

namespace App\Shared\Service;

use App\Shared\Entite\SessionConnexion;
use App\Shared\Entite\Utilisateur;
use App\Shared\Enum\MotifDeconnexion;

interface AuditConnexionServiceInterface
{
    public function rattacherOuOuvrir(
        Utilisateur $utilisateur,
        ?string $uuid,
        \DateTimeImmutable $expirationJeton,
        bool $nouvelleSession,
    ): SessionConnexion;

    public function cloturerSession(?Utilisateur $utilisateur, ?string $uuid, MotifDeconnexion $motif): void;

    public function sessionEstActive(string $uuid): bool;

    public function lister(
        Utilisateur $utilisateurConnecte,
        string $search,
        ?string $statut,
        ?string $dateDebut,
        ?string $dateFin,
        ?int $utilisateurId,
        int $page,
        string $limitRaw,
        ?string $portail = null,
    ): array;
}
