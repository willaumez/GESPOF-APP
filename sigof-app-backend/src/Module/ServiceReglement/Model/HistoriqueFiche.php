<?php

declare(strict_types=1);

namespace App\Module\ServiceReglement\Model;

use App\Shared\Model\Utilisateur;
use App\Module\ServiceReglement\Repository\HistoriqueFicheRepository;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity(repositoryClass: HistoriqueFicheRepository::class)]
#[ORM\Table(name: 'historique_fiche')]
class HistoriqueFiche
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column(type: Types::INTEGER)]
    private ?int $id = null;

    #[ORM\Column(length: 50)]
    private string $action;

    #[ORM\Column(type: Types::TEXT, nullable: true)]
    private ?string $commentaire = null;

    #[ORM\Column(name: 'date_action', type: Types::DATETIME_IMMUTABLE)]
    private \DateTimeImmutable $dateAction;

    #[ORM\Column(name: 'ancien_statut', length: 30, nullable: true)]
    private ?string $ancienStatut = null;

    #[ORM\Column(name: 'nouveau_statut', length: 30, nullable: true)]
    private ?string $nouveauStatut = null;

    #[ORM\ManyToOne(targetEntity: FicheDepot::class, inversedBy: 'historiques')]
    #[ORM\JoinColumn(name: 'fiche_reference', referencedColumnName: 'reference', nullable: false)]
    private ?FicheDepot $ficheDepense = null;

    #[ORM\ManyToOne(targetEntity: Utilisateur::class)]
    #[ORM\JoinColumn(name: 'utilisateur_id', referencedColumnName: 'id', nullable: false)]
    private Utilisateur $utilisateur;

    public function __construct()
    {
        $this->dateAction = new \DateTimeImmutable();
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getAction(): string
    {
        return $this->action;
    }

    public function setAction(string $action): static
    {
        $this->action = $action;

        return $this;
    }

    public function getCommentaire(): ?string
    {
        return $this->commentaire;
    }

    public function setCommentaire(?string $commentaire): static
    {
        $this->commentaire = $commentaire;

        return $this;
    }

    public function getDateAction(): \DateTimeImmutable
    {
        return $this->dateAction;
    }

    public function setDateAction(\DateTimeImmutable $dateAction): static
    {
        $this->dateAction = $dateAction;

        return $this;
    }

    public function getAncienStatut(): ?string
    {
        return $this->ancienStatut;
    }

    public function setAncienStatut(?string $ancienStatut): static
    {
        $this->ancienStatut = $ancienStatut;

        return $this;
    }

    public function getNouveauStatut(): ?string
    {
        return $this->nouveauStatut;
    }

    public function setNouveauStatut(?string $nouveauStatut): static
    {
        $this->nouveauStatut = $nouveauStatut;

        return $this;
    }

    public function getFicheDepot(): ?FicheDepot
    {
        return $this->ficheDepense;
    }

    public function setFicheDepot(?FicheDepot $ficheDepot): static
    {
        $this->ficheDepense = $ficheDepot;

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
}
