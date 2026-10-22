<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Entite\Referentiel;

use App\Module\ServiceOperationsFinancieres\Enum\NatureDepense;
use App\Module\ServiceOperationsFinancieres\Repository\RubriqueDepenseRepository;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;

/**
 * Rubrique du plan de comptes des dépenses SOF.
 * Structure symétrique à RubriqueRecette (nature à la place de section).
 * Clé primaire = code métier (jamais d'auto-increment).
 */
#[ORM\Entity(repositoryClass: RubriqueDepenseRepository::class)]
#[ORM\Table(name: 'sof_rubrique_depense')]
class RubriqueDepense
{
    #[ORM\Id]
    #[ORM\Column(name: 'code', type: Types::STRING, length: 10)]
    private string $code;

    #[ORM\Column(name: 'libelle', type: Types::STRING, length: 255)]
    private string $libelle;

    /** Profondeur dans l'arbre (racine = 1), calculée à la construction. */
    #[ORM\Column(name: 'niveau', type: Types::INTEGER)]
    private int $niveau;

    #[ORM\Column(name: 'nature', length: 30, enumType: NatureDepense::class)]
    private NatureDepense $nature;

    /**
     * true si le code a été inventé pour un regroupement sans code officiel
     * dans la nomenclature source.
     */
    #[ORM\Column(name: 'code_synthetique', type: Types::BOOLEAN, options: ['default' => false])]
    private bool $codeSynthetique = false;

    #[ORM\ManyToOne(targetEntity: self::class, inversedBy: 'enfants')]
    #[ORM\JoinColumn(name: 'parent_code', referencedColumnName: 'code', nullable: true, onDelete: 'RESTRICT')]
    private ?self $parent = null;

    /**
     * Collection en lecture seule : pas de add/remove public.
     *
     * @var Collection<int, self>
     */
    #[ORM\OneToMany(targetEntity: self::class, mappedBy: 'parent')]
    #[ORM\OrderBy(['code' => 'ASC'])]
    private Collection $enfants;

    public function __construct(
        string $code,
        string $libelle,
        NatureDepense $nature,
        ?self $parent = null,
        bool $codeSynthetique = false,
    ) {
        $this->code = $code;
        $this->libelle = $libelle;
        $this->nature = $nature;
        $this->parent = $parent;
        $this->codeSynthetique = $codeSynthetique;
        $this->niveau = $parent === null ? 1 : $parent->niveau + 1;
        $this->enfants = new ArrayCollection();

        $parent?->enfants->add($this);
    }

    public function getCode(): string
    {
        return $this->code;
    }

    public function getLibelle(): string
    {
        return $this->libelle;
    }

    public function setLibelle(string $libelle): static
    {
        $this->libelle = $libelle;

        return $this;
    }

    public function getNiveau(): int
    {
        return $this->niveau;
    }

    public function getNature(): NatureDepense
    {
        return $this->nature;
    }

    public function setNature(NatureDepense $nature): static
    {
        $this->nature = $nature;

        return $this;
    }

    public function isCodeSynthetique(): bool
    {
        return $this->codeSynthetique;
    }

    public function setCodeSynthetique(bool $codeSynthetique): static
    {
        $this->codeSynthetique = $codeSynthetique;

        return $this;
    }

    public function getParent(): ?self
    {
        return $this->parent;
    }

    /**
     * @return Collection<int, self>
     */
    public function getEnfants(): Collection
    {
        return $this->enfants;
    }

    public function estRacine(): bool
    {
        return $this->parent === null;
    }
}
