<?php

declare(strict_types=1);

namespace App\Module\ServicePrevision\Entite\FicheBleu;

use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;

/**
 * Modele reutilisable et modifiable par l'utilisateur. instancier() cree
 * une FicheBleue avec le squelette de sections/sous-sections (via les
 * SectionModele racine lies dans structure, et leur hierarchie propre),
 * montants vides, prete a etre remplie. Ne cree pas d'HistoriqueFicheBleue
 * (fonctionnalite pas encore reintegree).
 */
#[ORM\Entity]
#[ORM\Table(name: 'fiche_bleue_modele')]
class FicheBleueModele
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column(type: Types::INTEGER)]
    private ?int $id = null;

    #[ORM\Column(name: 'nom', length: 255)]
    private string $nom;

    #[ORM\Column(name: 'description', type: Types::TEXT, nullable: true)]
    private ?string $description = null;

    #[ORM\Column(name: 'actif', type: Types::BOOLEAN)]
    private bool $actif = true;

    #[ORM\Column(name: 'est_par_defaut', type: Types::BOOLEAN)]
    private bool $estParDefaut = false;

    /** Date de creation, mise a jour a chaque modification de la maquette. */
    #[ORM\Column(name: 'mis_a_jour_le', type: Types::DATETIME_IMMUTABLE)]
    private \DateTimeImmutable $misAJourLe;

    /**
     * @var Collection<int, FicheBleueModeleSection>
     */
    #[ORM\OneToMany(targetEntity: FicheBleueModeleSection::class, mappedBy: 'ficheBleueModele', cascade: ['persist', 'remove'], orphanRemoval: true)]
    #[ORM\OrderBy(['ordre' => 'ASC'])]
    private Collection $structure;

    /**
     * @var Collection<int, FicheBleue>
     */
    #[ORM\OneToMany(targetEntity: FicheBleue::class, mappedBy: 'modeleOrigine')]
    private Collection $fichesInstanciees;

    public function __construct(string $nom)
    {
        $this->nom = $nom;
        $this->misAJourLe = new \DateTimeImmutable();
        $this->structure = new ArrayCollection();
        $this->fichesInstanciees = new ArrayCollection();
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getNom(): string
    {
        return $this->nom;
    }

    public function setNom(string $nom): static
    {
        $this->nom = $nom;

        return $this;
    }

    public function getDescription(): ?string
    {
        return $this->description;
    }

    public function setDescription(?string $description): static
    {
        $this->description = $description;

        return $this;
    }

    public function isActif(): bool
    {
        return $this->actif;
    }

    public function setActif(bool $actif): static
    {
        $this->actif = $actif;

        return $this;
    }

    public function getMisAJourLe(): \DateTimeImmutable
    {
        return $this->misAJourLe;
    }

    /** A appeler a chaque modification de la maquette. */
    public function toucher(): static
    {
        $this->misAJourLe = new \DateTimeImmutable();

        return $this;
    }

    public function estParDefaut(): bool
    {
        return $this->estParDefaut;
    }

    public function setEstParDefaut(bool $estParDefaut): static
    {
        $this->estParDefaut = $estParDefaut;

        return $this;
    }

    /**
     * @return Collection<int, FicheBleueModeleSection>
     */
    public function getStructure(): Collection
    {
        return $this->structure;
    }

    public function ajouterStructureSection(FicheBleueModeleSection $structureSection): static
    {
        if (!$this->structure->contains($structureSection)) {
            $this->structure->add($structureSection);
            $structureSection->setFicheBleueModele($this);
        }

        return $this;
    }

    public function supprimerStructureSection(FicheBleueModeleSection $structureSection): static
    {
        if ($this->structure->removeElement($structureSection)) {
            if ($structureSection->getFicheBleueModele() === $this) {
                $structureSection->setFicheBleueModele(null);
            }
        }

        return $this;
    }

    /**
     * @return Collection<int, FicheBleue>
     */
    public function getFichesInstanciees(): Collection
    {
        return $this->fichesInstanciees;
    }

    /**
     * Cree une FicheBleue avec le squelette de Section/sous-Section genere a
     * partir des SectionModele racines liees dans structure (et leur
     * hierarchie propre via SectionModele::getSousSections()), montants a
     * zero, sans generer d'ElementLigne. Ne cree pas d'HistoriqueFicheBleue.
     */
    public function instancier(string $reference): FicheBleue
    {
        $fiche = new FicheBleue($reference);
        $fiche->setModeleOrigine($this);
        $fiche->setModeleOrigineId($this->id);

        foreach ($this->structure as $structureSection) {
            $sectionModeleRacine = $structureSection->getSectionModele();
            if ($sectionModeleRacine === null) {
                continue;
            }

            $section = $this->creerSectionDepuisModele($sectionModeleRacine, $structureSection->getOrdre());
            $fiche->ajouterSection($section);
        }

        $this->fichesInstanciees->add($fiche);

        return $fiche;
    }

    private function creerSectionDepuisModele(SectionModele $modele, int $ordre): Section
    {
        $section = new Section($modele->getCode() ?? '', $modele->getNom(), $modele->getTypeSection());
        $section->setOrdre($ordre);
        $section->setEstCalculee($modele->estCalculee());
        $section->setFormule($modele->getFormule());
        $section->setSectionModele($modele);

        foreach ($modele->getSousSections() as $sousModele) {
            $sousSection = $this->creerSectionDepuisModele($sousModele, $sousModele->getOrdreParDefaut());
            $section->ajouterSousSection($sousSection);
        }

        return $section;
    }
}
