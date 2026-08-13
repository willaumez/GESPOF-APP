<?php

declare(strict_types=1);

namespace App\Module\ServiceReglement\Model;

use App\Shared\Model\Utilisateur;
use App\Module\ServiceReglement\Repository\FicheDepotRepository;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity(repositoryClass: FicheDepotRepository::class)]
#[ORM\Table(name: 'fiche_depenses')]
class FicheDepot
{
    #[ORM\Id]
    #[ORM\Column(name: 'reference', type: Types::STRING, length: 25)]
    private string $reference;

    #[ORM\Column(name: 'date_creation', type: Types::DATETIME_IMMUTABLE)]
    private \DateTimeImmutable $dateCreation;

    #[ORM\Column(name: 'date_presentation', type: Types::DATETIME_MUTABLE)]
    private \DateTime $datePresentation;

    #[ORM\Column(name: 'statut', length: 30, nullable: true)]
    private ?string $statut = 'cree';

    #[ORM\Column(name: 'chemin_fichier', length: 500, nullable: true)]
    private ?string $cheminFichier = null;

    #[ORM\Column(name: 'hash_fichier', length: 255, nullable: true)]
    private ?string $hashFichier = null;

    #[ORM\ManyToOne(targetEntity: Utilisateur::class)]
    #[ORM\JoinColumn(name: 'utilisateur_id', referencedColumnName: 'id', nullable: false)]
    private Utilisateur $utilisateur;

    #[ORM\OneToMany(targetEntity: MouvementNumeraire::class, mappedBy: 'ficheDepenses', cascade: ['persist', 'remove'], orphanRemoval: true)]
    private Collection $mouvementsNumeraire;

    #[ORM\OneToMany(targetEntity: MouvementSygma::class, mappedBy: 'ficheDepenses', cascade: ['persist', 'remove'], orphanRemoval: true)]
    private Collection $mouvementsSygma;

    #[ORM\OneToMany(targetEntity: MouvementSystac::class, mappedBy: 'ficheDepenses', cascade: ['persist', 'remove'], orphanRemoval: true)]
    private Collection $mouvementsSystac;

    #[ORM\OneToMany(targetEntity: HistoriqueFiche::class, mappedBy: 'ficheDepense', cascade: ['persist', 'remove'])]
    private Collection $historiques;

    public function __construct(\DateTimeImmutable $datePresentation)
    {
        $suffix = str_pad((string) random_int(0, 9999), 4, '0', STR_PAD_LEFT);
        $this->reference = 'FD-' . $datePresentation->format('d-m-Y') . '-' . $suffix;
        $this->dateCreation = new \DateTimeImmutable();
        $this->mouvementsNumeraire = new ArrayCollection();
        $this->mouvementsSygma = new ArrayCollection();
        $this->mouvementsSystac = new ArrayCollection();
        $this->historiques = new ArrayCollection();
    }

    public function getReference(): string
    {
        return $this->reference;
    }

    public function getDateCreation(): \DateTimeImmutable
    {
        return $this->dateCreation;
    }

    public function setDateCreation(\DateTimeImmutable $dateCreation): static
    {
        $this->dateCreation = $dateCreation;

        return $this;
    }

    public function getDatePresentation(): \DateTime
    {
        return $this->datePresentation;
    }

    public function setDatePresentation(\DateTime $datePresentation): static
    {
        $this->datePresentation = $datePresentation;

        return $this;
    }

    public function getStatut(): ?string
    {
        return $this->statut;
    }

    public function setStatut(?string $statut): static
    {
        $this->statut = $statut;

        return $this;
    }

    public function getCheminFichier(): ?string
    {
        return $this->cheminFichier;
    }

    public function setCheminFichier(?string $cheminFichier): static
    {
        $this->cheminFichier = $cheminFichier;

        return $this;
    }

    public function getHashFichier(): ?string
    {
        return $this->hashFichier;
    }

    public function setHashFichier(?string $hashFichier): static
    {
        $this->hashFichier = $hashFichier;

        return $this;
    }

    public function getUtilisateur(): Utilisateur
    {
        return $this->utilisateur;
    }

    public function setUtilisateur(Utilisateur $utilisateur): static
    {
        $this->utilisateur = $utilisateur;

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
            $mouvement->setFicheDepot($this);
        }

        return $this;
    }

    public function removeMouvementNumeraire(MouvementNumeraire $mouvement): static
    {
        $this->mouvementsNumeraire->removeElement($mouvement);

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
            $mouvement->setFicheDepot($this);
        }

        return $this;
    }

    public function removeMouvementSygma(MouvementSygma $mouvement): static
    {
        $this->mouvementsSygma->removeElement($mouvement);

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
            $mouvement->setFicheDepot($this);
        }

        return $this;
    }

    public function removeMouvementSystac(MouvementSystac $mouvement): static
    {
        $this->mouvementsSystac->removeElement($mouvement);

        return $this;
    }

    public function getTotal(): float
    {
        return round($this->getTotalNumeraire() + $this->getTotalSigma() + $this->getTotalSystac(), 2);
    }

    public function getTotalNumeraire(): float
    {
        $total = 0.0;
        foreach ($this->mouvementsNumeraire as $mouvement) {
            $total += $mouvement->getDepenses();
        }

        return round($total, 2);
    }

    public function getTotalSigma(): float
    {
        $total = 0.0;
        foreach ($this->mouvementsSygma as $mouvement) {
            $total += $mouvement->getDepenses();
        }

        return round($total, 2);
    }

    public function getTotalSystac(): float
    {
        $total = 0.0;
        foreach ($this->mouvementsSystac as $mouvement) {
            $total += $mouvement->getDepenses();
        }

        return round($total, 2);
    }

    public function getTotalGroupe(): float
    {
        $total = 0.0;
        foreach ($this->mouvementsSystac as $mouvement) {
            $total += $mouvement->getMontantGroupe();
        }

        return round($total, 2);
    }

    public function getHistoriques(): Collection
    {
        return $this->historiques;
    }

    public function addHistorique(HistoriqueFiche $historique): static
    {
        if (!$this->historiques->contains($historique)) {
            $this->historiques->add($historique);
            $historique->setFicheDepot($this);
        }

        return $this;
    }

    public function removeHistorique(HistoriqueFiche $historique): static
    {
        $this->historiques->removeElement($historique);

        return $this;
    }
}
