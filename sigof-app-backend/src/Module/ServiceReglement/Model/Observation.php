<?php

declare(strict_types=1);

namespace App\Module\ServiceReglement\Model;

use App\Module\ServiceReglement\Repository\ObservationRepository;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity(repositoryClass: ObservationRepository::class)]
#[ORM\Table(name: 'observation')]
class Observation
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column(type: Types::INTEGER)]
    private ?int $id = null;

    #[ORM\Column(type: Types::TEXT)]
    private string $contenu;

    #[ORM\ManyToMany(targetEntity: MouvementNumeraire::class, mappedBy: 'observations')]
    private Collection $mouvementsNumeraire;

    #[ORM\ManyToMany(targetEntity: MouvementSygma::class, mappedBy: 'observations')]
    private Collection $mouvementsSygma;

    #[ORM\ManyToMany(targetEntity: MouvementSystac::class, mappedBy: 'observations')]
    private Collection $mouvementsSystac;

    public function __construct(string $contenu)
    {
        $this->contenu = $contenu;
        $this->mouvementsNumeraire = new ArrayCollection();
        $this->mouvementsSygma = new ArrayCollection();
        $this->mouvementsSystac = new ArrayCollection();
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getContenu(): string
    {
        return $this->contenu;
    }

    public function setContenu(string $contenu): static
    {
        $this->contenu = $contenu;

        return $this;
    }

    public function getMouvementsNumeraire(): Collection
    {
        return $this->mouvementsNumeraire;
    }

    public function addMouvementNumeraire(MouvementNumeraire $mouvement): static
    {
        if (!$this->mouvementsNumeraire->contains($mouvement)) {
            $this->mouvementsNumeraire->add($mouvement);
            $mouvement->addObservation($this);
        }

        return $this;
    }

    public function removeMouvementNumeraire(MouvementNumeraire $mouvement): static
    {
        if ($this->mouvementsNumeraire->removeElement($mouvement)) {
            $mouvement->removeObservation($this);
        }

        return $this;
    }

    public function getMouvementsSygma(): Collection
    {
        return $this->mouvementsSygma;
    }

    public function addMouvementSygma(MouvementSygma $mouvement): static
    {
        if (!$this->mouvementsSygma->contains($mouvement)) {
            $this->mouvementsSygma->add($mouvement);
            $mouvement->addObservation($this);
        }

        return $this;
    }

    public function removeMouvementSygma(MouvementSygma $mouvement): static
    {
        if ($this->mouvementsSygma->removeElement($mouvement)) {
            $mouvement->removeObservation($this);
        }

        return $this;
    }

    public function getMouvementsSystac(): Collection
    {
        return $this->mouvementsSystac;
    }

    public function addMouvementSystac(MouvementSystac $mouvement): static
    {
        if (!$this->mouvementsSystac->contains($mouvement)) {
            $this->mouvementsSystac->add($mouvement);
            $mouvement->addObservation($this);
        }

        return $this;
    }

    public function removeMouvementSystac(MouvementSystac $mouvement): static
    {
        if ($this->mouvementsSystac->removeElement($mouvement)) {
            $mouvement->removeObservation($this);
        }

        return $this;
    }
}
