<?php

declare(strict_types=1);

namespace App\Module\ServiceReglement\Entite;

use App\Module\ServiceReglement\Repository\MouvementSygmaRepository;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity(repositoryClass: MouvementSygmaRepository::class)]
#[ORM\Table(name: 'mouvement_sygma')]
class MouvementSygma
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column(type: Types::INTEGER)]
    private ?int $id = null;

    #[ORM\Column(name: 'date_virement', type: Types::DATETIME_MUTABLE, nullable: true)]
    private ?\DateTime $dateVirement = null;

    #[ORM\Column(length: 255)]
    private string $beneficiaire;

    #[ORM\Column(name: 'numero_ov', length: 100, nullable: true)]
    private ?string $numeroOV = null;

    #[ORM\Column(length: 100, nullable: true)]
    private ?string $banque = null;

    #[ORM\Column(type: Types::FLOAT)]
    private float $depenses;

    #[ORM\Column(length: 10, nullable: true)]
    private ?string $origine = null;

    #[ORM\Column(name: 'type_operation', length: 5, nullable: true)]
    private ?string $typeOperation = null;

    #[ORM\Column(length: 500, nullable: true)]
    private ?string $objet = null;

    #[ORM\Column(length: 500, nullable: true)]
    private ?string $com = null;

    #[ORM\Column(length: 100, nullable: true)]
    private ?string $exp = null;

    #[ORM\Column(length: 5, nullable: true)]
    private ?string $fisc = null;

    #[ORM\Column(length: 5, nullable: true)]
    private ?string $quittance = null;

    #[ORM\ManyToMany(targetEntity: Observation::class, inversedBy: 'mouvementsSygma', cascade: ['persist'])]
    #[ORM\JoinTable(name: 'mouvement_sygma_observation')]
    private Collection $observations;

    #[ORM\ManyToOne(targetEntity: FicheDepot::class, inversedBy: 'mouvementsSygma')]
    #[ORM\JoinColumn(name: 'fiche_reference', referencedColumnName: 'reference', nullable: false)]
    private ?FicheDepot $ficheDepenses = null;

    #[ORM\OneToMany(targetEntity: LigneSygma::class, mappedBy: 'mouvementSygma', cascade: ['remove'], orphanRemoval: true)]
    private Collection $lignesSygma;

    public function __construct(string $beneficiaire, float $depenses)
    {
        $this->beneficiaire = $beneficiaire;
        $this->depenses = $depenses;
        $this->observations = new ArrayCollection();
        $this->lignesSygma = new ArrayCollection();
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

    public function getOrigine(): ?string
    {
        return $this->origine;
    }

    public function setOrigine(?string $origine): static
    {
        $this->origine = $origine;

        return $this;
    }

    public function getTypeOperation(): ?string
    {
        return $this->typeOperation;
    }

    public function setTypeOperation(?string $typeOperation): static
    {
        $this->typeOperation = $typeOperation;

        return $this;
    }

    public function getObjet(): ?string
    {
        return $this->objet;
    }

    public function setObjet(?string $objet): static
    {
        $this->objet = $objet;

        return $this;
    }

    public function getCom(): ?string
    {
        return $this->com;
    }

    public function setCom(?string $com): static
    {
        $this->com = $com;

        return $this;
    }

    public function getExp(): ?string
    {
        return $this->exp;
    }

    public function setExp(?string $exp): static
    {
        $this->exp = $exp;

        return $this;
    }

    public function getFisc(): ?string
    {
        return $this->fisc;
    }

    public function setFisc(?string $fisc): static
    {
        $this->fisc = $fisc;

        return $this;
    }

    public function getQuittance(): ?string
    {
        return $this->quittance;
    }

    public function setQuittance(?string $quittance): static
    {
        $this->quittance = $quittance;

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
            $observation->addMouvementSygma($this);
        }

        return $this;
    }

    public function removeObservation(Observation $observation): static
    {
        if ($this->observations->removeElement($observation)) {
            $observation->removeMouvementSygma($this);
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

    public function getLignesSygma(): Collection
    {
        return $this->lignesSygma;
    }
}
