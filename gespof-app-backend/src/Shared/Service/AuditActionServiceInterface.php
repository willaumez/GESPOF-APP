<?php

declare(strict_types=1);

namespace App\Shared\Service;

use App\Shared\Entite\Utilisateur;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;

interface AuditActionServiceInterface
{
    public function enregistrerDepuisRequete(
        Request $request,
        Response $response,
        ?Utilisateur $utilisateur,
    ): void;

    public function lister(
        Utilisateur $utilisateurConnecte,
        string $portee,
        string $search,
        ?string $dateDebut,
        ?string $dateFin,
        ?string $methode,
        ?int $codeHttp,
        ?int $utilisateurId,
        int $page,
        string $limitRaw,
        ?string $portail = null,
    ): array;
}
