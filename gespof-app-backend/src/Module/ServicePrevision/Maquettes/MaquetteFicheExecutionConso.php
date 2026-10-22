<?php

declare(strict_types=1);

namespace App\Module\ServicePrevision\Maquettes;

use App\Module\ServicePrevision\Enum\TypeSection;

/**
 * Nomenclature initiale de la fiche d'exécution consolidée.
 * Les dépenses et les rubriques hors gabarit s'ajoutent à la clôture.
 *
 * @phpstan-type Noeud array{libelle: string, sous_sections?: list<array<string, mixed>>}
 */
final class MaquetteFicheExecutionConso
{
    /**
     * @return list<array{libelle: string, type: TypeSection, sous_sections: list<Noeud>}>
     */
    public static function arbre(): array
    {
        return [
            [
                'libelle' => MaquetteFicheBleue::LIBELLE_SOLDE,
                'type' => TypeSection::SOLDE,
                'sous_sections' => [
                    ['libelle' => MaquetteFicheBleue::LIBELLE_SOLDE_BEAC],
                    ['libelle' => MaquetteFicheBleue::LIBELLE_SOLDE_BGFI],
                ],
            ],
            ...array_map(
                static fn (array $noeud): array => [
                    'libelle' => (string) ($noeud['libelle'] ?? ''),
                    'type' => TypeSection::RECETTE,
                    'sous_sections' => $noeud['sous_sections'] ?? [],
                ],
                MaquetteFicheBleue::recettesProgrammees(),
            ),
        ];
    }
}
