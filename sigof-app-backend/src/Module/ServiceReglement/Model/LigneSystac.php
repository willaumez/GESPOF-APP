<?php

declare(strict_types=1);

namespace App\Module\ServiceReglement\Model;

use App\Module\ServiceReglement\Repository\LigneSystacRepository;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity(repositoryClass: LigneSystacRepository::class)]
#[ORM\Table(name: 'ligne_systac')]
class LigneSystac
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column(type: Types::INTEGER)]
    private ?int $id = null;

    #[ORM\Column(name: 'c_orig', length: 10, nullable: true)]
    private ?string $cOrig = null;

    #[ORM\Column(name: 'd_presentation', type: Types::DATETIME_MUTABLE, nullable: true)]
    private ?\DateTime $dPresentation = null;

    #[ORM\Column(name: 'l_orig', length: 100, nullable: true)]
    private ?string $lOrig = null;

    #[ORM\Column(name: 'n_bv', length: 20)]
    private string $nBv;

    #[ORM\Column(name: 'nb_regl', type: Types::FLOAT)]
    private float $nbRegl = 1.0;

    #[ORM\Column(name: 'montant_systac', type: Types::FLOAT)]
    private float $montantSystac = 0;

    #[ORM\Column(name: 'montant_groupe', type: Types::FLOAT)]
    private float $montantGroupe = 0;

    #[ORM\Column(length: 255)]
    private string $designation;

    #[ORM\Column(name: 'd_creation_ip', type: Types::DATETIME_IMMUTABLE, nullable: true)]
    private ?\DateTimeImmutable $dCreationIp = null;

    #[ORM\Column(name: 'd_generation', type: Types::DATETIME_IMMUTABLE, nullable: true)]
    private ?\DateTimeImmutable $dGeneration = null;

    #[ORM\ManyToOne(targetEntity: MouvementSystac::class, inversedBy: 'lignesSystac')]
    #[ORM\JoinColumn(name: 'mouvement_systac_id', referencedColumnName: 'id', nullable: true)]
    private ?MouvementSystac $mouvementSystac = null;

    public function __construct(string $nBv, string $designation)
    {
        $this->nBv = $nBv;
        $this->designation = $designation;
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getCOrig(): ?string
    {
        return $this->cOrig;
    }

    public function setCOrig(?string $cOrig): static
    {
        $this->cOrig = $cOrig;

        return $this;
    }

    public function getDPresentation(): ?\DateTime
    {
        return $this->dPresentation;
    }

    public function setDPresentation(?\DateTime $dPresentation): static
    {
        $this->dPresentation = $dPresentation;

        return $this;
    }

    public function getLOrig(): ?string
    {
        return $this->lOrig;
    }

    public function setLOrig(?string $lOrig): static
    {
        $this->lOrig = $lOrig;

        return $this;
    }

    public function getNBv(): string
    {
        return $this->nBv;
    }

    public function setNBv(string $nBv): static
    {
        $this->nBv = $nBv;

        return $this;
    }

    public function getNbRegl(): float
    {
        return $this->nbRegl;
    }

    public function setNbRegl(float $nbRegl): static
    {
        $this->nbRegl = $nbRegl;

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

    public function getDesignation(): string
    {
        return $this->designation;
    }

    public function setDesignation(string $designation): static
    {
        $this->designation = $designation;

        return $this;
    }

    public function getDCreationIp(): ?\DateTimeImmutable
    {
        return $this->dCreationIp;
    }

    public function setDCreationIp(?\DateTimeImmutable $dCreationIp): static
    {
        $this->dCreationIp = $dCreationIp;

        return $this;
    }

    public function getDGeneration(): ?\DateTimeImmutable
    {
        return $this->dGeneration;
    }

    public function setDGeneration(?\DateTimeImmutable $dGeneration): static
    {
        $this->dGeneration = $dGeneration;

        return $this;
    }

    public function getMouvementSystac(): ?MouvementSystac
    {
        return $this->mouvementSystac;
    }

    public function setMouvementSystac(?MouvementSystac $mouvementSystac): static
    {
        $this->mouvementSystac = $mouvementSystac;

        return $this;
    }
}
