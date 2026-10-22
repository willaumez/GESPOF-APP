<?php

declare(strict_types=1);

namespace App\Module\ServicePrevision\Entite\FicheExecutionConso;

use App\Module\ServicePrevision\Enum\TypeSection;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;

/**
 * Rubrique de la nomenclature consolidée (arbre unique, partagé).
 */
#[ORM\Entity]
#[ORM\Table(name: 'conso_rubrique')]
#[ORM\UniqueConstraint(name: 'UNIQ_CONSO_RUBRIQUE_CLE', columns: ['cle'])]
class ConsoRubrique
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column(type: Types::INTEGER)]
    private ?int $id = null;

    #[ORM\Column(name: 'nom', length: 255)]
    private string $nom;

    #[ORM\Column(name: 'cle', length: 512)]
    private string $cle;

    #[ORM\Column(name: 'type', length: 20, enumType: TypeSection::class)]
    private TypeSection $type;

    #[ORM\Column(name: 'ordre', type: Types::INTEGER)]
    private int $ordre = 0;

    #[ORM\ManyToOne(targetEntity: self::class, inversedBy: 'enfants')]
    #[ORM\JoinColumn(name: 'parent_id', referencedColumnName: 'id', nullable: true, onDelete: 'CASCADE')]
    private ?self $parent = null;

    /**
     * @var Collection<int, self>
     */
    #[ORM\OneToMany(targetEntity: self::class, mappedBy: 'parent', cascade: ['persist'], orphanRemoval: true)]
    #[ORM\OrderBy(['ordre' => 'ASC', 'id' => 'ASC'])]
    private Collection $enfants;

    /**
     * @var Collection<int, ConsoValeurJour>
     */
    #[ORM\OneToMany(targetEntity: ConsoValeurJour::class, mappedBy: 'rubrique', cascade: ['persist', 'remove'], orphanRemoval: true)]
    private Collection $valeurs;

    public function __construct(string $nom, string $cle, TypeSection $type)
    {
        $this->nom = $nom;
        $this->cle = $cle;
        $this->type = $type;
        $this->enfants = new ArrayCollection();
        $this->valeurs = new ArrayCollection();
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getNom(): string
    {
        return $this->nom;
    }

    public function getCle(): string
    {
        return $this->cle;
    }

    public function getType(): TypeSection
    {
        return $this->type;
    }

    public function getOrdre(): int
    {
        return $this->ordre;
    }

    public function setOrdre(int $ordre): static
    {
        $this->ordre = $ordre;

        return $this;
    }

    public function getParent(): ?self
    {
        return $this->parent;
    }

    public function setParent(?self $parent): static
    {
        $this->parent = $parent;

        return $this;
    }

    public function estRacine(): bool
    {
        return $this->parent === null;
    }

    public function estFeuille(): bool
    {
        return $this->enfants->isEmpty();
    }

    /**
     * @return Collection<int, self>
     */
    public function getEnfants(): Collection
    {
        return $this->enfants;
    }

    public function ajouterEnfant(self $enfant): static
    {
        if (!$this->enfants->contains($enfant)) {
            $this->enfants->add($enfant);
            $enfant->setParent($this);
        }

        return $this;
    }

    /**
     * @return Collection<int, ConsoValeurJour>
     */
    public function getValeurs(): Collection
    {
        return $this->valeurs;
    }
}
