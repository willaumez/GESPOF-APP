<?php

declare(strict_types=1);

namespace App\Module\ServicePrevision\Service;

/**
 * Listes validées (recettes Oracle, dépenses des fiches de dépôt) d'une journée
 * et leur rapprochement avec les rubriques de la Fiche d'exécution.
 */
interface RapprochementServiceInterface
{
    public const TYPE_RECETTE = 'recette';
    public const TYPE_DEPENSE = 'depense';

    /** @return array{recettes_jour: array<string, mixed>|null} */
    public function recettes(string $referenceJournee): array;

    /**
     * Fige les recettes Oracle de la date d'ouverture. Une liste déjà validée
     * est remplacée, en conservant les recettes déjà rapprochées.
     *
     * @return array{recettes_jour: array<string, mixed>}
     */
    public function validerRecettes(string $referenceJournee, string $dateOuverture, string $validePar): array;

    /**
     * Liste validée + état des fiches de dépôt reçues depuis la validation.
     *
     * @return array{
     *     depenses_jour: array<string, mixed>|null,
     *     fiches_disponibles: list<array<string, mixed>>,
     *     fiches_non_integrees: list<string>,
     *     nouvelles: int
     * }
     */
    public function depenses(string $referenceJournee): array;

    /**
     * Fusionne toutes les fiches de dépôt reçues pour la journée, sans doublon :
     * une fiche complémentaire qui reprend la précédente n'ajoute que ses nouveaux
     * éléments. Les dépenses déjà rapprochées sont conservées.
     *
     * @return array{depenses_jour: array<string, mixed>, nouvelles: int}
     */
    public function validerDepenses(string $referenceJournee, string $validePar): array;

    /**
     * Ajoute la somme des éléments au réalisé de la rubrique et les marque rapprochés.
     *
     * @param list<string> $cles
     *
     * @return array{liste: array<string, mixed>, fiche: array<string, mixed>}
     */
    public function rapprocher(
        string $referenceJournee,
        string $type,
        array $cles,
        int $sectionId,
        string $par,
    ): array;

    /**
     * Annule un rapprochement (groupe d'éléments déposés ensemble) :
     * retire leur somme du réalisé de la rubrique.
     *
     * @return array{liste: array<string, mixed>, fiche: array<string, mixed>}
     */
    public function annulerRapprochement(string $referenceJournee, string $type, string $groupe): array;
}
