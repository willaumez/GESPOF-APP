<?php

declare(strict_types=1);

namespace App\Module\ServicePrevision\Entite;

use App\Module\ServicePrevision\Entite\FicheBleu\Section;
use App\Module\ServicePrevision\Enum\TypeSection;
use App\Module\ServicePrevision\Service\Exception\DonneesInvalidesException;
use Doctrine\Common\Collections\Collection;

/**
 * Composition partagée Fiche Bleue / Fiche d'exécution : arbre de Section,
 * avec exactement une section racine de type SOLDE (en-tête obligatoire).
 *
 * L'entité utilisatrice doit exposer getSections() et rattacherSection()
 * (lien vers FicheBleue ou FicheExecution).
 */
trait CompositionSectionsTrait
{
    /**
     * @return Collection<int, Section>
     */
    abstract public function getSections(): Collection;

    /** Pose le lien propriétaire (fiche bleue ou fiche d'exécution) sur la section. */
    abstract protected function rattacherSection(Section $section): void;

    abstract protected function detacherSection(Section $section): void;

    public function ajouterSection(Section $section): static
    {
        if (!$section->estSousSection() && $section->getType() === TypeSection::SOLDE) {
            $existante = $this->getSectionSoldeRacine();
            if ($existante !== null && $existante !== $section) {
                throw new DonneesInvalidesException(
                    'Une fiche ne peut contenir qu\'une seule section Solde (en-tête).',
                );
            }
            // En-tête figé : non retirable via la sélection agent.
            $section->setEstSelectionnable(false);
        }

        if (!$this->getSections()->contains($section)) {
            $this->attacherSectionEtDescendants($section);
        }

        return $this;
    }

    public function supprimerSection(Section $section): static
    {
        if (!$section->estSousSection() && $section->getType() === TypeSection::SOLDE) {
            throw new DonneesInvalidesException(
                'La section Solde est obligatoire et ne peut pas être retirée de la fiche.',
            );
        }

        if ($this->getSections()->removeElement($section)) {
            $this->detacherSection($section);
        }

        return $this;
    }

    /**
     * Section racine de type SOLDE (en-tête), ou null si absente.
     */
    public function getSectionSoldeRacine(): ?Section
    {
        foreach ($this->getSectionsRacines() as $section) {
            if ($section->getType() === TypeSection::SOLDE) {
                return $section;
            }
        }

        return null;
    }

    /**
     * Exige exactement une section racine SOLDE.
     *
     * @throws DonneesInvalidesException
     */
    public function validerCompositionSolde(): void
    {
        $soldes = array_values(array_filter(
            $this->getSectionsRacines(),
            static fn (Section $s): bool => $s->getType() === TypeSection::SOLDE,
        ));

        if (count($soldes) === 0) {
            throw new DonneesInvalidesException(
                'La fiche doit comporter exactement une section Solde (en-tête obligatoire).',
            );
        }

        if (count($soldes) > 1) {
            throw new DonneesInvalidesException(
                'Une fiche ne peut contenir qu\'une seule section Solde (en-tête).',
            );
        }
    }

    /**
     * Recherche une Section (racine ou sous-section) par son nom exact.
     */
    public function getSectionByNom(string $nom): ?Section
    {
        foreach ($this->getSections() as $section) {
            if ($section->getNom() === $nom) {
                return $section;
            }
        }

        return null;
    }

    /**
     * Rattache la Section (et récursivement toute sa descendance) à cette fiche.
     */
    protected function attacherSectionEtDescendants(Section $section): void
    {
        if (!$this->getSections()->contains($section)) {
            $this->getSections()->add($section);
        }
        $this->rattacherSection($section);

        foreach ($section->getSousSections() as $sousSection) {
            $this->attacherSectionEtDescendants($sousSection);
        }
    }

    /**
     * @return Section[]
     */
    protected function getSectionsRacines(): array
    {
        return array_values(array_filter(
            $this->getSections()->toArray(),
            static fn (Section $section): bool => !$section->estSousSection(),
        ));
    }
}
