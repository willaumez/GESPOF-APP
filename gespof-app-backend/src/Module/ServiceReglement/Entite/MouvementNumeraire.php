<?php

declare(strict_types=1);

namespace App\Module\ServiceReglement\Entite;

use App\Module\ServiceReglement\Repository\MouvementNumeraireRepository;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity(repositoryClass: MouvementNumeraireRepository::class)]
#[ORM\Table(name: 'mouvement_numeraire')]
class MouvementNumeraire
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column(type: Types::INTEGER)]
    private ?int $id = null;

    #[ORM\Column(name: 'date_virement', type: Types::DATETIME_MUTABLE, nullable: true)]
    private ?\DateTime $dateVirement = null;

    #[ORM\Column(length: 255)]
    private string $beneficiaire;

    #[ORM\Column(name: 'numero_ov', length: 50, nullable: true)]
    private ?string $numeroOV = null;

    #[ORM\Column(length: 100, nullable: true)]
    private ?string $banque = null;

    #[ORM\Column(type: Types::FLOAT)]
    private float $depenses;

    #[ORM\Column(name: 'reference_externe', length: 100, nullable: true)]
    private ?string $referenceExterne = null;

    #[ORM\Column(name: 'modifie_manuellement', type: Types::BOOLEAN, options: ['default' => false])]
    private bool $modifieManuellement = false;

    #[ORM\ManyToMany(targetEntity: Observation::class, inversedBy: 'mouvementsNumeraire', cascade: ['persist'])]
    #[ORM\JoinTable(name: 'mouvement_numeraire_observation')]
    private Collection $observations;

    #[ORM\ManyToOne(targetEntity: FicheDepot::class, inversedBy: 'mouvementsNumeraire')]
    #[ORM\JoinColumn(name: 'fiche_reference', referencedColumnName: 'reference', nullable: false)]
    private ?FicheDepot $ficheDepenses = null;

    public function __construct(string $beneficiaire, float $depenses)
    {
        $this->beneficiaire = $beneficiaire;
        $this->depenses = $depenses;
        $this->observations = new ArrayCollection();
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getDateVirement(): ?\DateTime
    {
        return $this->dateVirement;
    }

    public function setDateVirement(?\DateTime $dateVirement): static
    {
        $this->dateVirement = $dateVirement;

        return $this;
    }

    public function getBeneficiaire(): string
    {
        return $this->beneficiaire;
    }

    public function setBeneficiaire(string $beneficiaire): static
    {
        $this->beneficiaire = $beneficiaire;

        return $this;
    }

    public function getNumeroOV(): ?string
    {
        return $this->numeroOV;
    }

    public function setNumeroOV(?string $numeroOV): static
    {
        $this->numeroOV = $numeroOV;

        return $this;
    }

    public function getBanque(): ?string
    {
        return $this->banque;
    }

    public function setBanque(?string $banque): static
    {
        $this->banque = $banque;

        return $this;
    }

    public function getDepenses(): float
    {
        return $this->depenses;
    }

    public function setDepenses(float $depenses): static
    {
        $this->depenses = $depenses;

        return $this;
    }

    public function getReferenceExterne(): ?string
    {
        return $this->referenceExterne;
    }

    public function setReferenceExterne(?string $referenceExterne): static
    {
        $this->referenceExterne = $referenceExterne;

        return $this;
    }

    public function isModifieManuellement(): bool
    {
        return $this->modifieManuellement;
    }

    public function setModifieManuellement(bool $modifieManuellement): static
    {
        $this->modifieManuellement = $modifieManuellement;

        return $this;
    }

    public function getObservations(): Collection
    {
        return $this->observations;
    }

    public function addObservation(Observation $observation): static
    {
        if (!$this->observations->contains($observation)) {
            $this->observations->add($observation);
            $observation->addMouvementNumeraire($this);
        }

        return $this;
    }

    public function removeObservation(Observation $observation): static
    {
        if ($this->observations->removeElement($observation)) {
            $observation->removeMouvementNumeraire($this);
        }

        return $this;
    }

    public function getFicheDepot(): ?FicheDepot
    {
        return $this->ficheDepenses;
    }

    public function setFicheDepot(?FicheDepot $ficheDepot): static
    {
        $this->ficheDepenses = $ficheDepot;

        return $this;
    }
}
