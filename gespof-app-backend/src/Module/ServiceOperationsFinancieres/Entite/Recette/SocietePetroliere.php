<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Entite\Recette;

use App\Module\ServiceOperationsFinancieres\Repository\SocietePetroliereRepository;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;

/**
 * Société pétrolière (plan phase 0 — table societe_petroliere).
 * Clé primaire = matricule métier.
 */
#[ORM\Entity(repositoryClass: SocietePetroliereRepository::class)]
#[ORM\Table(name: 'sof_societe_petroliere')]
class SocietePetroliere
{
    #[ORM\Id]
    #[ORM\Column(name: 'matricule', type: Types::STRING, length: 32)]
    private string $matricule;

    #[ORM\Column(name: 'nom', type: Types::STRING, length: 255)]
    private string $nom;

    #[ORM\Column(name: 'champ_nif', type: Types::STRING, length: 64, nullable: true)]
    private ?string $champNif = null;

    /** Source à confirmer : nullable (le classeur y mettait le NIF). */
    #[ORM\Column(name: 'redevance_sup_min', type: Types::DECIMAL, precision: 20, scale: 2, nullable: true)]
    private ?string $redevanceSupMin = null;

    #[ORM\Column(name: 'petrole', type: Types::BOOLEAN, options: ['default' => true])]
    private bool $petrole = true;

    public function __construct(
        string $matricule,
        string $nom,
        ?string $champNif = null,
        ?string $redevanceSupMin = null,
        bool $petrole = true,
    ) {
        $this->matricule = $matricule;
        $this->nom = $nom;
        $this->champNif = $champNif;
        $this->redevanceSupMin = $redevanceSupMin;
        $this->petrole = $petrole;
    }

    public function getMatricule(): string
    {
        return $this->matricule;
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

    public function getChampNif(): ?string
    {
        return $this->champNif;
    }

    public function setChampNif(?string $champNif): static
    {
        $t = $champNif !== null ? trim($champNif) : null;
        $this->champNif = $t === '' ? null : $t;

        return $this;
    }

    /** Compat. ancien champ nif. */
    public function getNif(): ?string
    {
        return $this->champNif;
    }

    public function setNif(?string $nif): static
    {
        return $this->setChampNif($nif);
    }

    public function getRedevanceSupMin(): ?string
    {
        return $this->redevanceSupMin;
    }

    public function setRedevanceSupMin(?string $redevanceSupMin): static
    {
        $this->redevanceSupMin = $redevanceSupMin;

        return $this;
    }

    public function isPetrole(): bool
    {
        return $this->petrole;
    }

    public function setPetrole(bool $petrole): static
    {
        $this->petrole = $petrole;

        return $this;
    }
}
