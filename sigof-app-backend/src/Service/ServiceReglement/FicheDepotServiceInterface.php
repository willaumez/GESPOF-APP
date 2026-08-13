<?php

declare(strict_types=1);

namespace App\Service\ServiceReglement;

use App\Shared\Model\Utilisateur;
use App\Service\ServiceReglement\Exception\ActionInterditeException;
use App\Service\ServiceReglement\Exception\AucuneLigneTrouveeException;
use App\Service\ServiceReglement\Exception\DateInvalideException;
use App\Service\ServiceReglement\Exception\DonneesInvalidesException;
use App\Service\ServiceReglement\Exception\FicheIntrouvableException;
use App\Service\ServiceReglement\Exception\FichierIntrouvableException;
use App\Service\ServiceReglement\Exception\MouvementIntrouvableException;
use App\Service\ServiceReglement\Exception\StatutInvalideException;

interface FicheDepotServiceInterface
{


    public function genererFicheAvecProgress(?string $dateStr, Utilisateur $user, callable $progressCallback): array;

    public function genererFiche(?string $dateStr, Utilisateur $user): array;

    public function lister(?string $statut, string $tri, string $ordre): array;

    public function fichesPaginees(int $page, string $limitRaw, string $search, string $statut): array;

    public function detail(string $reference): array;

    public function changerStatut(string $reference, ?string $nouveauStatut, ?string $commentaire, Utilisateur $user): string;

    public function cheminFichier(string $reference): array;

    public function supprimer(string $reference, Utilisateur $user): void;

    public function creerMouvement(string $reference, string $famille, array $donnees, Utilisateur $user): array;

    public function modifierMouvement(string $reference, string $famille, int $id, array $donnees, Utilisateur $user): array;

    public function supprimerMouvement(string $reference, string $famille, int $id, Utilisateur $user): void;
}
