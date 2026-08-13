<?php

declare(strict_types=1);

namespace App\Module\ServiceReglement\Model;

use App\Module\ServiceReglement\Repository\LigneSygmaRepository;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity(repositoryClass: LigneSygmaRepository::class)]
#[ORM\Table(name: 'ligne_sygma')]
class LigneSygma
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column(type: Types::INTEGER)]
    private ?int $id = null;

    #[ORM\Column(length: 10, nullable: true)]
    private ?string $orig = null;

    #[ORM\Column(name: 'n_doc', length: 20, nullable: true)]
    private ?string $nDoc = null;

    #[ORM\Column(name: 'd_presentation', type: Types::DATETIME_MUTABLE, nullable: true)]
    private ?\DateTime $dPresentation = null;

    #[ORM\Column(name: 'c_typ', length: 5, nullable: true)]
    private ?string $cTyp = null;

    #[ORM\Column(name: 'montant_sygma', type: Types::FLOAT)]
    private float $montantSygma = 0;

    #[ORM\Column(name: 'c_ref', length: 100, nullable: true)]
    private ?string $cRef = null;

    #[ORM\Column(name: 'l_tiers', length: 255, nullable: true)]
    private ?string $lTiers = null;

    #[ORM\Column(name: 'l_obj', length: 500, nullable: true)]
    private ?string $lObj = null;

    #[ORM\Column(name: 'l_com', length: 500, nullable: true)]
    private ?string $lCom = null;

    #[ORM\Column(name: 'l_exp', length: 100, nullable: true)]
    private ?string $lExp = null;

    #[ORM\Column(name: 'l_dest', length: 100, nullable: true)]
    private ?string $lDest = null;

    #[ORM\Column(name: 'c_fisc', length: 5, nullable: true)]
    private ?string $cFisc = null;

    #[ORM\Column(name: 'c_quit', length: 5, nullable: true)]
    private ?string $cQuit = null;

    #[ORM\ManyToOne(targetEntity: MouvementSygma::class, inversedBy: 'lignesSygma')]
    #[ORM\JoinColumn(name: 'mouvement_sygma_id', referencedColumnName: 'id', nullable: true)]
    private ?MouvementSygma $mouvementSygma = null;

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getOrig(): ?string
    {
        return $this->orig;
    }

    public function setOrig(?string $orig): static
    {
        $this->orig = $orig;

        return $this;
    }

    public function getNDoc(): ?string
    {
        return $this->nDoc;
    }

    public function setNDoc(?string $nDoc): static
    {
        $this->nDoc = $nDoc;

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

    public function getCTyp(): ?string
    {
        return $this->cTyp;
    }

    public function setCTyp(?string $cTyp): static
    {
        $this->cTyp = $cTyp;

        return $this;
    }

    public function getMontantSygma(): float
    {
        return $this->montantSygma;
    }

    public function setMontantSygma(float $montantSygma): static
    {
        $this->montantSygma = $montantSygma;

        return $this;
    }

    public function getCRef(): ?string
    {
        return $this->cRef;
    }

    public function setCRef(?string $cRef): static
    {
        $this->cRef = $cRef;

        return $this;
    }

    public function getLTiers(): ?string
    {
        return $this->lTiers;
    }

    public function setLTiers(?string $lTiers): static
    {
        $this->lTiers = $lTiers;

        return $this;
    }

    public function getLObj(): ?string
    {
        return $this->lObj;
    }

    public function setLObj(?string $lObj): static
    {
        $this->lObj = $lObj;

        return $this;
    }

    public function getLCom(): ?string
    {
        return $this->lCom;
    }

    public function setLCom(?string $lCom): static
    {
        $this->lCom = $lCom;

        return $this;
    }

    public function getLExp(): ?string
    {
        return $this->lExp;
    }

    public function setLExp(?string $lExp): static
    {
        $this->lExp = $lExp;

        return $this;
    }

    public function getLDest(): ?string
    {
        return $this->lDest;
    }

    public function setLDest(?string $lDest): static
    {
        $this->lDest = $lDest;

        return $this;
    }

    public function getCFisc(): ?string
    {
        return $this->cFisc;
    }

    public function setCFisc(?string $cFisc): static
    {
        $this->cFisc = $cFisc;

        return $this;
    }

    public function getCQuit(): ?string
    {
        return $this->cQuit;
    }

    public function setCQuit(?string $cQuit): static
    {
        $this->cQuit = $cQuit;

        return $this;
    }

    public function getMouvementSygma(): ?MouvementSygma
    {
        return $this->mouvementSygma;
    }

    public function setMouvementSygma(?MouvementSygma $mouvementSygma): static
    {
        $this->mouvementSygma = $mouvementSygma;

        return $this;
    }
}
