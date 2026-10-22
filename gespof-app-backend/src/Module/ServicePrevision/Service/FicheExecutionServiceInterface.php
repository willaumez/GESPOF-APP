<?php

declare(strict_types=1);

namespace App\Module\ServicePrevision\Service;

use App\Module\ServicePrevision\Entite\FicheBleu\FicheBleue;
use App\Module\ServicePrevision\Entite\FicheExecution\FicheExecution;

interface FicheExecutionServiceInterface
{
    /**
     * Cherche la Fiche d'exécution déjà liée à la journée (null si absente).
     */
    public function trouverPourJournee(string $referenceJournee): array;

    /**
     * Crée la Fiche d'exécution depuis la Fiche Bleue si aucune n'existe encore.
     * Si une fiche est déjà liée, la retourne sans en créer une nouvelle.
     */
    public function creerPourJournee(string $referenceJournee, string $createur): array;

    public function detail(int $id): array;

    /**
     * Recopie l'arbre programmé de la Fiche Bleue (type → section → sous-section)
     * tout en conservant les montants réalisés déjà saisis.
     */
    public function synchroniserDepuisFicheBleue(FicheExecution $fiche, FicheBleue $ficheBleue): void;

    /**
     * Applique des montants réalisés sur des sections feuilles, puis
     * recalcule parents, écarts et totaux de la journée.
     *
     * @param array<string, mixed> $donnees
     */
    public function appliquerMontantsRealise(int $ficheId, array $donnees, bool $journaliser = true): array;

    /**
     * Ajoute une recette ou une dépense hors programmation
     * (sous la section « … NON PROGRAMMEES », créée si besoin).
     *
     * @param array<string, mixed> $donnees
     */
    public function ajouterSectionNonProgrammee(int $ficheId, array $donnees): array;

    /**
     * Met à jour le libellé et/ou le réalisé d'une rubrique non programmée.
     *
     * @param array<string, mixed> $donnees
     */
    public function modifierSectionNonProgrammee(int $ficheId, int $sectionId, array $donnees): array;

    /**
     * Supprime une rubrique non programmée (et ses sous-sections).
     */
    public function supprimerSectionNonProgrammee(int $ficheId, int $sectionId): array;

    /**
     * Réordonne des rubriques sœurs (glisser-déposer).
     *
     * @param array<string, mixed> $donnees
     */
    public function reordonnerSectionsNonProgrammees(int $ficheId, array $donnees): array;
}
