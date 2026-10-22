<?php

declare(strict_types=1);

namespace App\Module\ServicePrevision\Service;

use App\Module\ServicePrevision\Entite\FicheExecution\FicheExecution;
use App\Module\ServicePrevision\Entite\JourneeTresorerie\JourneeTresorerie;

interface FicheExecutionConsoServiceInterface
{
    /**
     * Insère (idempotent) l'arbre initial Solde + Recettes programmées.
     */
    public function assurerMaquette(): void;

    /**
     * Fusionne l'arbre de la fiche d'exécution clôturée (type → section →
     * sous-section) et enregistre les montants réalisés du jour. Les rubriques
     * absentes sont créées dans la nomenclature consolidée.
     */
    public function fusionnerDepuisJournee(JourneeTresorerie $journee, FicheExecution $fiche): void;

    /**
     * Supprime les valeurs consolidées d'une journée (archives).
     */
    public function supprimerValeursJournee(string $referenceJournee): void;

    /**
     * Matrice consolidée selon la vue : semaine | mois | annee.
     *
     * @return array<string, mixed>
     */
    public function matrice(?string $vue = 'semaine', ?string $dateIso = null): array;
}
