<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Entite\Recette;

use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;

/**
 * Société pétrolière (référentiel SOF des recettes pétrolières).
 */
#[ORM\Entity]
#[ORM\Table(name: 'sof_societe_petroliere')]
class SocietePetroliere
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column(type: Types::INTEGER)]
    private ?int $id = null;

    /** Unique mais facultatif : plusieurs NULL autorisés. */
    #[ORM\Column(name: 'nif', type: Types::STRING, length: 20, unique: true, nullable: true)]
    private ?string $nif;

    #[ORM\Column(name: 'nom', type: Types::STRING, length: 255)]
    private string $nom;

    #[ORM\Column(name: 'actif', type: Types::BOOLEAN, options: ['default' => true])]
    private bool $actif = true;

    public function __construct(string $nom, ?string $nif = null)
    {
        $this->nom = $nom;
        $this->nif = $nif;
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

    public function getNom(): string
    {
        return $this->nom;
    }

    public function setNom(string $nom): static
    {
        $this->nom = $nom;

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
