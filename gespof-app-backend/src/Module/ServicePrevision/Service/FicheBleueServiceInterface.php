<?php

declare(strict_types=1);

namespace App\Module\ServicePrevision\Service;

interface FicheBleueServiceInterface
{
    /**
     * Liste paginée des fiches bleues (plus récentes d'abord).
     * Filtres optionnels : date (jour), recherche (q), statut, plage de dates.
     */
    public function lister(
        int $page = 1,
        int $limite = 10,
        ?string $date = null,
        ?string $recherche = null,
        ?string $statut = null,
        ?string $dateDebut = null,
        ?string $dateFin = null,
    ): array;

    public function detail(int $id): array;

    /**
     * Crée une Fiche Bleue (statut BROUILLON) à partir de la bibliothèque.
     * Exige une journée de trésorerie ouverte pour le jour, une section Solde
     * (existante ou créée et ajoutée à la bibliothèque) en en-tête, puis les
     * autres sections dans l'ordre fourni.
     */
    public function creer(array $donnees, string $createur): array;

    /**
     * Remplace la composition d'une Fiche Bleue existante (même payload que creer),
     * puis recalcule les totaux. Les identifiants de sections changent.
     */
    public function modifier(int $id, array $donnees, string $createur): array;

    /**
     * Applique des montants programmés sur des sections feuilles, puis
     * recalcule parents et totaux de la fiche (règles entity).
     *
     * Payload : { "montants": [ { "section_id": int, "montant_programme": string }, ... ] }
     */
    public function appliquerMontantsProgramme(int $ficheId, array $donnees): array;

    /**
     * Met à jour libellés / montants de sections existantes et insère des
     * lignes (copie depuis les opérations Oracle), puis recalcule les totaux.
     *
     * Payload :
     * - mises_a_jour : [ { section_id, nom?, montant_programme?, ordre? } ]
     * - insertions : [ { parent_id?, position, nom, type, montant_programme, enfants? } ]
     */
    public function programmerSections(int $ficheId, array $donnees): array;
}
