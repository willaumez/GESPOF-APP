<?php

declare(strict_types=1);

namespace App\Module\ServicePrevision\Service;

interface BibliothequeSectionServiceInterface
{
    public function lister(?string $recherche = null, int $page = 1, int $limite = 10, ?string $type = null): array;

    public function detail(int $id): array;

    public function creer(array $donnees, string $createur): array;

    public function modifier(int $id, array $donnees): array;

    public function deplacer(int $id, array $donnees): array;

    public function supprimer(int $id): void;

    /**
     * Insère (idempotent) l'arbre canonique (Solde + sections Recette +
     * sections Dépense) dans la bibliothèque. Retourne le nombre de nœuds créés.
     */
    public function assurerMaquetteParDefaut(string $createur = 'Système'): int;
}
