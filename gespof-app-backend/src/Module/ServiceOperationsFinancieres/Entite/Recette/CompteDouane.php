<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Entite\Recette;

use App\Module\ServiceOperationsFinancieres\Enum\TypeCompteDouane;
use App\Module\ServiceOperationsFinancieres\Repository\CompteDouaneRepository;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;

/**
 * Compte douanier du modèle automatisé (référentiel SOF).
 * Clé primaire = numéro de compte métier (4784-101, 4784-31, 4663-218...).
 */
#[ORM\Entity(repositoryClass: CompteDouaneRepository::class)]
#[ORM\Table(name: 'sof_compte_douane')]
#[ORM\Index(name: 'idx_sof_compte_douane_type', columns: ['type'])]
class CompteDouane
{
    #[ORM\Id]
    #[ORM\Column(name: 'compte', type: Types::STRING, length: 20)]
    private string $compte;

    #[ORM\Column(name: 'type', length: 40, enumType: TypeCompteDouane::class)]
    private TypeCompteDouane $type;

    #[ORM\Column(name: 'libelle_compte', type: Types::STRING, length: 255)]
    private string $libelleCompte;

    /** Désactiver plutôt que supprimer si des recettes existent. */
    #[ORM\Column(name: 'actif', type: Types::BOOLEAN, options: ['default' => true])]
    private bool $actif = true;

    public function __construct(TypeCompteDouane $type, string $compte, string $libelleCompte)
    {
        $this->type = $type;
        $this->compte = $compte;
        $this->libelleCompte = $libelleCompte;
    }

    public function getCompte(): string
    {
        return $this->compte;
    }

    public function getType(): TypeCompteDouane
    {
        return $this->type;
    }

    public function setType(TypeCompteDouane $type): static
    {
        $this->type = $type;

        return $this;
    }

    public function getLibelleCompte(): string
    {
        return $this->libelleCompte;
    }

    public function setLibelleCompte(string $libelleCompte): static
    {
        $this->libelleCompte = $libelleCompte;

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
