<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Entite\Import;

use App\Module\ServiceOperationsFinancieres\Enum\TypeDcMandat;
use App\Module\ServiceOperationsFinancieres\Repository\DcMandatRepository;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;

/**
 * Ligne mandat TVA DC — F4 (REGLE) / F5 (RAP) · table dc_mandat.
 */
#[ORM\Entity(repositoryClass: DcMandatRepository::class)]
#[ORM\Table(name: 'sof_dc_mandat')]
#[ORM\Index(name: 'idx_sof_dc_mandat_lot', columns: ['lot_id'])]
#[ORM\Index(name: 'idx_sof_dc_mandat_n_emis', columns: ['n_emis'])]
#[ORM\Index(name: 'idx_sof_dc_mandat_matric', columns: ['matric'])]
class DcMandat
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column(name: 'id', type: Types::INTEGER)]
    private ?int $id = null;

    #[ORM\ManyToOne(targetEntity: LotImport::class)]
    #[ORM\JoinColumn(name: 'lot_id', referencedColumnName: 'id', nullable: false, onDelete: 'CASCADE')]
    private LotImport $lot;

    #[ORM\Column(name: 'type', type: Types::STRING, length: 8, enumType: TypeDcMandat::class)]
    private TypeDcMandat $type;

    #[ORM\Column(name: 'n_emis', type: Types::STRING, length: 32, nullable: true)]
    private ?string $nEmis = null;

    #[ORM\Column(name: 'n_regl', type: Types::STRING, length: 32, nullable: true)]
    private ?string $nRegl = null;

    #[ORM\Column(name: 'd_emis', type: Types::DATE_IMMUTABLE, nullable: true)]
    private ?\DateTimeImmutable $dEmis = null;

    #[ORM\Column(name: 'dat_regl', type: Types::DATE_IMMUTABLE, nullable: true)]
    private ?\DateTimeImmutable $datRegl = null;

    #[ORM\Column(name: 'compte', type: Types::STRING, length: 32, nullable: true)]
    private ?string $compte = null;

    #[ORM\Column(name: 'nat', type: Types::STRING, length: 16, nullable: true)]
    private ?string $nat = null;

    #[ORM\Column(name: 'pc', type: Types::STRING, length: 16, nullable: true)]
    private ?string $pc = null;

    #[ORM\Column(name: 'mdr', type: Types::STRING, length: 16, nullable: true)]
    private ?string $mdr = null;

    #[ORM\Column(name: 'matric', type: Types::STRING, length: 64, nullable: true)]
    private ?string $matric = null;

    #[ORM\Column(name: 'nom', type: Types::STRING, length: 255, nullable: true)]
    private ?string $nom = null;

    #[ORM\Column(name: 'montant', type: Types::DECIMAL, precision: 20, scale: 2, nullable: true)]
    private ?string $montant = null;

    #[ORM\Column(name: 'm_net', type: Types::DECIMAL, precision: 20, scale: 2, nullable: true)]
    private ?string $mNet = null;

    #[ORM\Column(name: 'd_visa', type: Types::DATE_IMMUTABLE, nullable: true)]
    private ?\DateTimeImmutable $dVisa = null;

    #[ORM\Column(name: 'objet', type: Types::STRING, length: 500, nullable: true)]
    private ?string $objet = null;

    #[ORM\Column(name: 'c_blocag', type: Types::STRING, length: 32, nullable: true)]
    private ?string $cBlocag = null;

    #[ORM\Column(name: 'orig', type: Types::STRING, length: 16, nullable: true)]
    private ?string $orig = null;

    #[ORM\Column(name: 'num_bv', type: Types::STRING, length: 64, nullable: true)]
    private ?string $numBv = null;

    public function __construct(LotImport $lot, TypeDcMandat $type)
    {
        $this->lot = $lot;
        $this->type = $type;
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getLot(): LotImport
    {
        return $this->lot;
    }

    public function getType(): TypeDcMandat
    {
        return $this->type;
    }

    public function getNEmis(): ?string
    {
        return $this->nEmis;
    }

    public function setNEmis(?string $nEmis): static
    {
        $this->nEmis = $nEmis;

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

    public function getDEmis(): ?\DateTimeImmutable
    {
        return $this->dEmis;
    }

    public function setDEmis(?\DateTimeImmutable $dEmis): static
    {
        $this->dEmis = $dEmis;

        return $this;
    }

    public function getDatRegl(): ?\DateTimeImmutable
    {
        return $this->datRegl;
    }

    public function setDatRegl(?\DateTimeImmutable $datRegl): static
    {
        $this->datRegl = $datRegl;

        return $this;
    }

    public function getCompte(): ?string
    {
        return $this->compte;
    }

    public function setCompte(?string $compte): static
    {
        $this->compte = $compte;

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

    public function getPc(): ?string
    {
        return $this->pc;
    }

    public function setPc(?string $pc): static
    {
        $this->pc = $pc;

        return $this;
    }

    public function getMdr(): ?string
    {
        return $this->mdr;
    }

    public function setMdr(?string $mdr): static
    {
        $this->mdr = $mdr;

        return $this;
    }

    public function getMatric(): ?string
    {
        return $this->matric;
    }

    public function setMatric(?string $matric): static
    {
        $this->matric = $matric;

        return $this;
    }

    public function getNom(): ?string
    {
        return $this->nom;
    }

    public function setNom(?string $nom): static
    {
        $this->nom = $nom;

        return $this;
    }

    public function getMontant(): ?string
    {
        return $this->montant;
    }

    public function setMontant(?string $montant): static
    {
        $this->montant = $montant;

        return $this;
    }

    public function getMNet(): ?string
    {
        return $this->mNet;
    }

    public function setMNet(?string $mNet): static
    {
        $this->mNet = $mNet;

        return $this;
    }

    public function getDVisa(): ?\DateTimeImmutable
    {
        return $this->dVisa;
    }

    public function setDVisa(?\DateTimeImmutable $dVisa): static
    {
        $this->dVisa = $dVisa;

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

    public function getCBlocag(): ?string
    {
        return $this->cBlocag;
    }

    public function setCBlocag(?string $cBlocag): static
    {
        $this->cBlocag = $cBlocag;

        return $this;
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

    public function getNumBv(): ?string
    {
        return $this->numBv;
    }

    public function setNumBv(?string $numBv): static
    {
        $this->numBv = $numBv;

        return $this;
    }
}
