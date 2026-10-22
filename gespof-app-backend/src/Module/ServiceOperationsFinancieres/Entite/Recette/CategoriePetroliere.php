<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Entite\Recette;

use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;

/**
 * Catégorie de recette pétrolière, sur deux niveaux :
 * section (parent = null) ou sous-section (parent renseigné).
 * Gérée en base : désactiver plutôt que supprimer si des recettes existent.
 */
#[ORM\Entity]
#[ORM\Table(name: 'sof_categorie_petroliere')]
class CategoriePetroliere
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column(type: Types::INTEGER)]
    private ?int $id = null;

    /** Code de la ligne de section (ex. 4783-1N01). Non unique. */
    #[ORM\Column(name: 'nif', type: Types::STRING, length: 20, nullable: true)]
    private ?string $nif = null;

    #[ORM\Column(name: 'nom_categorie', type: Types::STRING, length: 255)]
    private string $nomCategorie;

    /** null = section ; renseigné = sous-section. */
    #[ORM\ManyToOne(targetEntity: self::class)]
    #[ORM\JoinColumn(name: 'parent_id', referencedColumnName: 'id', nullable: true, onDelete: 'RESTRICT')]
    private ?self $parent = null;

    #[ORM\Column(name: 'ordre', type: Types::SMALLINT)]
    private int $ordre = 0;

    /** Exclue du « Total net », incluse dans « Total y.c. compensations ». */
    #[ORM\Column(name: 'est_compensation', type: Types::BOOLEAN, options: ['default' => false])]
    private bool $estCompensation = false;

    #[ORM\Column(name: 'actif', type: Types::BOOLEAN, options: ['default' => true])]
    private bool $actif = true;

    public function __construct(string $nomCategorie, ?string $nif = null, ?self $parent = null)
    {
        $this->nomCategorie = $nomCategorie;
        $this->nif = $nif;
        $this->parent = $parent;
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getNif(): ?string
    {
        return $this->nif;
    }

    public function setNif(?string $nif): static
    {
        $this->nif = $nif;

        return $this;
    }

    public function getNomCategorie(): string
    {
        return $this->nomCategorie;
    }

    public function setNomCategorie(string $nomCategorie): static
    {
        $this->nomCategorie = $nomCategorie;

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

    public function estSection(): bool
    {
        return $this->parent === null;
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

    public function isEstCompensation(): bool
    {
        return $this->estCompensation;
    }

    public function setEstCompensation(bool $estCompensation): static
    {
        $this->estCompensation = $estCompensation;

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
}
