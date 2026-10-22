<?php

declare(strict_types=1);

namespace App\Module\ServicePrevision\Service;

interface JourneeTresorerieServiceInterface
{
    /**
     * Crée une journée (référence JT-…, état BROUILLON) sans fiches liées.
     */
    public function creer(): array;

    public function detail(string $reference): array;

    /** Dernière journée créée (pour reprise éventuelle côté fiche matinale). */
    public function derniere(): ?array;

    /** Journée du jour calendaire (`journee` null si absente). */
    public function duJour(): array;

    /**
     * Journée du jour calendaire $dateIso (YYYY-MM-DD).
     *
     * @return array{journee: array<string, mixed>|null}
     */
    public function parDate(string $dateIso): array;

    /**
     * Lie une Fiche Bleue à la journée (par id), statut fiche → EN_COURS.
     */
    public function lierFicheBleue(string $referenceJournee, int $ficheBleueId): array;

    /**
     * Clôture la journée (et les fiches liées).
     *
     * @return array{journee: array<string, mixed>}
     */
    public function cloturer(string $reference): array;

    /**
     * Réouvre une journée clôturée : retire ses valeurs de la fiche consolidée
     * et repasse les fiches liées EN_COURS. Sans $journeeAnterieureAutorisee
     * (réservé au chef de service), seule la journée la plus récente est acceptée.
     *
     * @return array{journee: array<string, mixed>}
     */
    public function reouvrir(string $reference, bool $journeeAnterieureAutorisee = false): array;

    /**
     * Notifie le SR qu'une fiche de dépôt est attendue (optionnel).
     *
     * @return array{envoye: bool, deja_envoyee: bool}
     */
    public function demanderFicheDepot(string $reference): array;

    /**
     * Liste paginée des journées (archives).
     *
     * @return array{journees: list<array<string, mixed>>, total: int, page: int, pages: int, limite: int}
     */
    public function lister(
        int $page = 1,
        int $limite = 10,
        ?string $date = null,
        ?string $recherche = null,
        ?string $etat = null,
        ?string $dateDebut = null,
        ?string $dateFin = null,
    ): array;

    /**
     * Supprime la journée et les documents liés (Fiche Bleue, Fiche d'exécution,
     * fiches de dépôt reçues).
     */
    public function supprimer(string $reference): void;
}
