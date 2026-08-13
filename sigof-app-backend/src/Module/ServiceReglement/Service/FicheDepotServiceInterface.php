<?php

declare(strict_types=1);

namespace App\Module\ServiceReglement\Service;

use App\Shared\Model\Utilisateur;
use App\Module\ServiceReglement\Service\Exception\ActionInterditeException;
use App\Module\ServiceReglement\Service\Exception\AucuneLigneTrouveeException;
use App\Module\ServiceReglement\Service\Exception\DateInvalideException;
use App\Module\ServiceReglement\Service\Exception\DonneesInvalidesException;
use App\Module\ServiceReglement\Service\Exception\FicheIntrouvableException;
use App\Module\ServiceReglement\Service\Exception\FichierIntrouvableException;
use App\Module\ServiceReglement\Service\Exception\MouvementIntrouvableException;
use App\Module\ServiceReglement\Service\Exception\StatutInvalideException;

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
