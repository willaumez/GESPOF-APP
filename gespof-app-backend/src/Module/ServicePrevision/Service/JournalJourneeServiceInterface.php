<?php

declare(strict_types=1);

namespace App\Module\ServicePrevision\Service;

use App\Module\ServicePrevision\Entite\JourneeTresorerie\JourneeTresorerie;

/**
 * Audit journalier : événements métier d'une journée de trésorerie
 * (qui a fait quoi, et à quelle heure).
 */
interface JournalJourneeServiceInterface
{
    public const OUVERTURE = 'ouverture';
    public const CLOTURE = 'cloture';
    public const REOUVERTURE = 'reouverture';
    public const FICHE_BLEUE_LIEE = 'fiche_bleue_liee';
    public const FICHE_BLEUE_MODIFIEE = 'fiche_bleue_modifiee';
    public const PROGRAMME_SAISI = 'programme_saisi';
    public const FICHE_EXECUTION_CREEE = 'fiche_execution_creee';
    public const REALISE_SAISI = 'realise_saisi';
    public const RUBRIQUE_AJOUTEE = 'rubrique_ajoutee';
    public const RUBRIQUE_MODIFIEE = 'rubrique_modifiee';
    public const RUBRIQUE_SUPPRIMEE = 'rubrique_supprimee';
    public const RUBRIQUES_REORDONNEES = 'rubriques_reordonnees';
    public const FICHE_DEPOT_DEMANDEE = 'fiche_depot_demandee';
    public const FICHE_DEPOT_ENVOYEE = 'fiche_depot_envoyee';
    public const FICHE_DEPOT_RECUE = 'fiche_depot_recue';
    public const RECETTES_VALIDEES = 'recettes_validees';
    public const DEPENSES_VALIDEES = 'depenses_validees';
    public const RAPPROCHEMENT = 'rapprochement';
    public const RAPPROCHEMENT_ANNULE = 'rapprochement_annule';

    /**
     * Enregistre un événement pour l'utilisateur connecté (« Système » sans session).
     * Ne doit jamais faire échouer l'action métier : les erreurs sont journalisées.
     *
     * @param array<string, mixed> $details
     */
    public function enregistrer(JourneeTresorerie $journee, string $type, string $libelle, array $details = []): void;

    /** Vrai si la journée a déjà fait l'objet d'au moins une réouverture. */
    public function aEteReouverte(JourneeTresorerie $journee): bool;

    /**
     * Événements de la journée, du plus ancien au plus récent, et sa synthèse.
     *
     * @return array{journee: array<string, mixed>, evenements: list<array<string, mixed>>}
     */
    public function historique(string $referenceJournee): array;
}
