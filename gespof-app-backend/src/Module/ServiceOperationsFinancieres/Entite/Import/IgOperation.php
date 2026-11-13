<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Entite\Import;

use App\Module\ServiceOperationsFinancieres\Repository\IgOperationRepository;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;

/**
 * Ligne d'opération IG format F1 / VIDR (plan phase 1 — table ig_operation).
 */
#[ORM\Entity(repositoryClass: IgOperationRepository::class)]
#[ORM\Table(name: 'sof_ig_operation')]
#[ORM\Index(name: 'idx_sof_ig_operation_lot', columns: ['lot_id'])]
#[ORM\Index(name: 'idx_sof_ig_operation_compte_date', columns: ['c_it', 'd_cpta'])]
#[ORM\Index(name: 'idx_sof_ig_operation_n_regl', columns: ['n_regl'])]
#[ORM\Index(name: 'idx_sof_ig_operation_n_mattir', columns: ['n_mattir'])]
#[ORM\Index(name: 'idx_sof_ig_operation_c_ref1', columns: ['c_ref1'])]
class IgOperation
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column(name: 'id', type: Types::INTEGER)]
    private ?int $id = null;

    #[ORM\ManyToOne(targetEntity: LotImport::class)]
    #[ORM\JoinColumn(name: 'lot_id', referencedColumnName: 'id', nullable: false, onDelete: 'CASCADE')]
    private LotImport $lot;

    #[ORM\Column(name: 'c_pca', type: Types::STRING, length: 16, nullable: true)]
    private ?string $cPca = null;

    #[ORM\Column(name: 'd_cpta', type: Types::DATE_IMMUTABLE, nullable: true)]
    private ?\DateTimeImmutable $dCpta = null;

    #[ORM\Column(name: 'n_regl', type: Types::STRING, length: 32, nullable: true)]
    private ?string $nRegl = null;

    #[ORM\Column(name: 'n_lig_r', type: Types::INTEGER, nullable: true)]
    private ?int $nLigR = null;

    #[ORM\Column(name: 'c_typ_op', type: Types::STRING, length: 16, nullable: true)]
    private ?string $cTypOp = null;

    #[ORM\Column(name: 'n_op', type: Types::STRING, length: 32, nullable: true)]
    private ?string $nOp = null;

    #[ORM\Column(name: 'c_guic', type: Types::STRING, length: 32, nullable: true)]
    private ?string $cGuic = null;

    #[ORM\Column(name: 'n_mattir', type: Types::STRING, length: 64, nullable: true)]
    private ?string $nMattir = null;

    #[ORM\Column(name: 'l_np', type: Types::STRING, length: 255, nullable: true)]
    private ?string $lNp = null;

    #[ORM\Column(name: 'c_ope', type: Types::STRING, length: 32, nullable: true)]
    private ?string $cOpe = null;

    #[ORM\Column(name: 'c_it', type: Types::STRING, length: 32, nullable: true)]
    private ?string $cIt = null;

    #[ORM\Column(name: 'c_nat', type: Types::STRING, length: 32, nullable: true)]
    private ?string $cNat = null;

    #[ORM\Column(name: 'c_ref1', type: Types::STRING, length: 64, nullable: true)]
    private ?string $cRef1 = null;

    #[ORM\Column(name: 'c_ref2', type: Types::STRING, length: 64, nullable: true)]
    private ?string $cRef2 = null;

    #[ORM\Column(name: 'm_regl', type: Types::DECIMAL, precision: 20, scale: 2, nullable: true)]
    private ?string $mRegl = null;

    #[ORM\Column(name: 'c_nop', type: Types::STRING, length: 8, nullable: true)]
    private ?string $cNop = null;

    #[ORM\Column(name: 'c_mdr', type: Types::STRING, length: 16, nullable: true)]
    private ?string $cMdr = null;

    #[ORM\Column(name: 'n_cheq', type: Types::STRING, length: 64, nullable: true)]
    private ?string $nCheq = null;

    #[ORM\Column(name: 'c_cais', type: Types::STRING, length: 32, nullable: true)]
    private ?string $cCais = null;

    #[ORM\Column(name: 'l_tiers', type: Types::STRING, length: 255, nullable: true)]
    private ?string $lTiers = null;

    public function __construct(LotImport $lot)
    {
        $this->lot = $lot;
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getLot(): LotImport
    {
        return $this->lot;
    }

    public function getCPca(): ?string
    {
        return $this->cPca;
    }

    public function setCPca(?string $cPca): static
    {
        $this->cPca = $cPca;

        return $this;
    }

    public function getDCpta(): ?\DateTimeImmutable
    {
        return $this->dCpta;
    }

    public function setDCpta(?\DateTimeImmutable $dCpta): static
    {
        $this->dCpta = $dCpta;

        return $this;
    }

    public function getNRegl(): ?string
    {
        return $this->nRegl;
    }

    public function setNRegl(?string $nRegl): static
    {
        $this->nRegl = $nRegl;

        return $this;
    }

    public function getNLigR(): ?int
    {
        return $this->nLigR;
    }

    public function setNLigR(?int $nLigR): static
    {
        $this->nLigR = $nLigR;

        return $this;
    }

    public function getCTypOp(): ?string
    {
        return $this->cTypOp;
    }

    public function setCTypOp(?string $cTypOp): static
    {
        $this->cTypOp = $cTypOp;

        return $this;
    }

    public function getNOp(): ?string
    {
        return $this->nOp;
    }

    public function setNOp(?string $nOp): static
    {
        $this->nOp = $nOp;

        return $this;
    }

    public function getCGuic(): ?string
    {
        return $this->cGuic;
    }

    public function setCGuic(?string $cGuic): static
    {
        $this->cGuic = $cGuic;

        return $this;
    }

    public function getNMattir(): ?string
    {
        return $this->nMattir;
    }

    public function setNMattir(?string $nMattir): static
    {
        $this->nMattir = $nMattir;

        return $this;
    }

    public function getLNp(): ?string
    {
        return $this->lNp;
    }

    public function setLNp(?string $lNp): static
    {
        $this->lNp = $lNp;

        return $this;
    }

    public function getCOpe(): ?string
    {
        return $this->cOpe;
    }

    public function setCOpe(?string $cOpe): static
    {
        $this->cOpe = $cOpe;

        return $this;
    }

    public function getCIt(): ?string
    {
        return $this->cIt;
    }

    public function setCIt(?string $cIt): static
    {
        $this->cIt = $cIt;

        return $this;
    }

    public function getCNat(): ?string
    {
        return $this->cNat;
    }

    public function setCNat(?string $cNat): static
    {
        $this->cNat = $cNat;

        return $this;
    }

    public function getCRef1(): ?string
    {
        return $this->cRef1;
    }

    public function setCRef1(?string $cRef1): static
    {
        $this->cRef1 = $cRef1;

        return $this;
    }

    public function getCRef2(): ?string
    {
        return $this->cRef2;
    }

    public function setCRef2(?string $cRef2): static
    {
        $this->cRef2 = $cRef2;

        return $this;
    }

    public function getMRegl(): ?string
    {
        return $this->mRegl;
    }

    public function setMRegl(?string $mRegl): static
    {
        $this->mRegl = $mRegl;

        return $this;
    }

    public function getCNop(): ?string
    {
        return $this->cNop;
    }

    public function setCNop(?string $cNop): static
    {
        $this->cNop = $cNop;

        return $this;
    }

    public function getCMdr(): ?string
    {
        return $this->cMdr;
    }

    public function setCMdr(?string $cMdr): static
    {
        $this->cMdr = $cMdr;

        return $this;
    }

    public function getNCheq(): ?string
    {
        return $this->nCheq;
    }

    public function setNCheq(?string $nCheq): static
    {
        $this->nCheq = $nCheq;

        return $this;
    }

    public function getCCais(): ?string
    {
        return $this->cCais;
    }

    public function setCCais(?string $cCais): static
    {
        $this->cCais = $cCais;

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
}
