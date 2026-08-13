<?php

declare(strict_types=1);

namespace App\Entity\ServiceReglement;

use App\Repository\ServiceReglement\MouvementSystacRepository;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity(repositoryClass: MouvementSystacRepository::class)]
#[ORM\Table(name: 'mouvement_systac')]
class MouvementSystac
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

    #[ORM\Column(name: 'montant_systac', type: Types::FLOAT)]
    private float $montantSystac = 0;

    #[ORM\Column(name: 'montant_groupe', type: Types::FLOAT)]
    private float $montantGroupe = 0;

    #[ORM\Column(length: 255, nullable: true)]
    private ?string $designation = null;

    #[ORM\Column(name: 'date_creation_ip', type: Types::DATETIME_IMMUTABLE, nullable: true)]
    private ?\DateTimeImmutable $dateCreationIp = null;

    #[ORM\Column(name: 'date_generation', type: Types::DATETIME_IMMUTABLE, nullable: true)]
    private ?\DateTimeImmutable $dateGeneration = null;

    #[ORM\ManyToMany(targetEntity: Observation::class, inversedBy: 'mouvementsSystac', cascade: ['persist'])]
    #[ORM\JoinTable(name: 'mouvement_systac_observation')]
    private Collection $observations;

    #[ORM\ManyToOne(targetEntity: FicheDepot::class, inversedBy: 'mouvementsSystac')]
    #[ORM\JoinColumn(name: 'fiche_reference', referencedColumnName: 'reference', nullable: false)]
    private ?FicheDepot $ficheDepenses = null;

    #[ORM\OneToMany(targetEntity: LigneSystac::class, mappedBy: 'mouvementSystac', cascade: ['remove'], orphanRemoval: true)]
    private Collection $lignesSystac;

    public function __construct(string $beneficiaire, float $depenses)
    {
        $this->beneficiaire = $beneficiaire;
        $this->depenses = $depenses;
        $this->observations = new ArrayCollection();
        $this->lignesSystac = new ArrayCollection();
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

    public function getMontantSystac(): float
    {
        return $this->montantSystac;
    }

    public function setMontantSystac(float $montantSystac): static
    {
        $this->montantSystac = $montantSystac;

        return $this;
    }

    public function getMontantGroupe(): float
    {
        return $this->montantGroupe;
    }

    public function setMontantGroupe(float $montantGroupe): static
    {
        $this->montantGroupe = $montantGroupe;

        return $this;
    }

    public function getDesignation(): ?string
    {
        return $this->designation;
    }

    public function setDesignation(?string $designation): static
    {
        $this->designation = $designation;

        return $this;
    }

    public function getDateCreationIp(): ?\DateTimeImmutable
    {
        return $this->dateCreationIp;
    }

    public function setDateCreationIp(?\DateTimeImmutable $dateCreationIp): static
    {
        $this->dateCreationIp = $dateCreationIp;

        return $this;
    }

    public function getDateGeneration(): ?\DateTimeImmutable
    {
        return $this->dateGeneration;
    }

    public function setDateGeneration(?\DateTimeImmutable $dateGeneration): static
    {
        $this->dateGeneration = $dateGeneration;

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
            $observation->addMouvementSystac($this);
        }

        return $this;
    }

    public function removeObservation(Observation $observation): static
    {
        if ($this->observations->removeElement($observation)) {
            $observation->removeMouvementSystac($this);
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

    public function getLignesSystac(): Collection
    {
        return $this->lignesSystac;
    }
}
