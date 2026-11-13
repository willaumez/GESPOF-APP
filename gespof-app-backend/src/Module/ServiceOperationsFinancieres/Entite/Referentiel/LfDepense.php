<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Entite\Referentiel;

use App\Module\ServiceOperationsFinancieres\Repository\LfDepenseRepository;
use App\Module\ServiceOperationsFinancieres\Support\Montant;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity(repositoryClass: LfDepenseRepository::class)]
#[ORM\Table(name: 'sof_lf_depense')]
#[ORM\Index(name: 'idx_sof_lf_depense_loi', columns: ['loi_id'])]
class LfDepense
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column(name: 'id', type: Types::INTEGER)]
    private ?int $id = null;

    #[ORM\ManyToOne(targetEntity: LoiFinances::class, inversedBy: 'depenses')]
    #[ORM\JoinColumn(name: 'loi_id', referencedColumnName: 'id', nullable: false, onDelete: 'CASCADE')]
    private ?LoiFinances $loi = null;

    #[ORM\Column(name: 'mission', type: Types::STRING, length: 32, nullable: true)]
    private ?string $mission = null;

    #[ORM\Column(name: 'l_mis', type: Types::STRING, length: 255, nullable: true)]
    private ?string $lMis = null;

    #[ORM\Column(name: 'prog', type: Types::STRING, length: 32, nullable: true)]
    private ?string $prog = null;

    #[ORM\Column(name: 'titre', type: Types::STRING, length: 16, nullable: true)]
    private ?string $titre = null;

    #[ORM\Column(name: 'l_titre', type: Types::STRING, length: 255, nullable: true)]
    private ?string $lTitre = null;

    #[ORM\Column(name: 'bop', type: Types::STRING, length: 32, nullable: true)]
    private ?string $bop = null;

    #[ORM\Column(name: 'l_bop', type: Types::STRING, length: 255, nullable: true)]
    private ?string $lBop = null;

    #[ORM\Column(name: 'l_prog', type: Types::STRING, length: 255, nullable: true)]
    private ?string $lProg = null;

    #[ORM\Column(name: 'budget', type: Types::STRING, length: 32, nullable: true)]
    private ?string $budget = null;

    #[ORM\Column(name: 'nat', type: Types::STRING, length: 32, nullable: true)]
    private ?string $nat = null;

    #[ORM\Column(name: 'montant', type: Types::DECIMAL, precision: 20, scale: 2)]
    private string $montant = '0.00';

    public function __construct(string $montant = '0.00')
    {
        $this->montant = Montant::normaliser($montant);
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getLoi(): ?LoiFinances
    {
        return $this->loi;
    }

    public function setLoi(?LoiFinances $loi): static
    {
        $this->loi = $loi;

        return $this;
    }

    public function getMission(): ?string
    {
        return $this->mission;
    }

    public function setMission(?string $mission): static
    {
        $this->mission = $mission;

        return $this;
    }

    public function getLMis(): ?string
    {
        return $this->lMis;
    }

    public function setLMis(?string $lMis): static
    {
        $this->lMis = $lMis;

        return $this;
    }

    public function getProg(): ?string
    {
        return $this->prog;
    }

    public function setProg(?string $prog): static
    {
        $this->prog = $prog;

        return $this;
    }

    public function getTitre(): ?string
    {
        return $this->titre;
    }

    public function setTitre(?string $titre): static
    {
        $this->titre = $titre;

        return $this;
    }

    public function getLTitre(): ?string
    {
        return $this->lTitre;
    }

    public function setLTitre(?string $lTitre): static
    {
        $this->lTitre = $lTitre;

        return $this;
    }

    public function getBop(): ?string
    {
        return $this->bop;
    }

    public function setBop(?string $bop): static
    {
        $this->bop = $bop;

        return $this;
    }

    public function getLBop(): ?string
    {
        return $this->lBop;
    }

    public function setLBop(?string $lBop): static
    {
        $this->lBop = $lBop;

        return $this;
    }

    public function getLProg(): ?string
    {
        return $this->lProg;
    }

    public function setLProg(?string $lProg): static
    {
        $this->lProg = $lProg;

        return $this;
    }

    public function getBudget(): ?string
    {
        return $this->budget;
    }

    public function setBudget(?string $budget): static
    {
        $this->budget = $budget;

        return $this;
    }

    public function getNat(): ?string
    {
        return $this->nat;
    }

    public function setNat(?string $nat): static
    {
        $this->nat = $nat;

        return $this;
    }

    public function getMontant(): string
    {
        return $this->montant;
    }

    public function setMontant(string $montant): static
    {
        $this->montant = Montant::normaliser($montant);

        return $this;
    }
}
