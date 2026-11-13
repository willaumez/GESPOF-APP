<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Entite\Import;

use App\Module\ServiceOperationsFinancieres\Repository\DcReglementRepository;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;

/**
 * Ligne règlement sur ordonnance DC — F2 · XRGV · table dc_reglement.
 */
#[ORM\Entity(repositoryClass: DcReglementRepository::class)]
#[ORM\Table(name: 'sof_dc_reglement')]
#[ORM\Index(name: 'idx_sof_dc_reglement_lot', columns: ['lot_id'])]
#[ORM\Index(name: 'idx_sof_dc_reglement_ordo_nregl', columns: ['ordonnance', 'n_regl'])]
#[ORM\Index(name: 'idx_sof_dc_reglement_dat_regl', columns: ['dat_regl'])]
#[ORM\Index(name: 'idx_sof_dc_reglement_titre_nat', columns: ['titre', 'nat'])]
class DcReglement
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column(name: 'id', type: Types::INTEGER)]
    private ?int $id = null;

    #[ORM\ManyToOne(targetEntity: LotImport::class)]
    #[ORM\JoinColumn(name: 'lot_id', referencedColumnName: 'id', nullable: false, onDelete: 'CASCADE')]
    private LotImport $lot;

    #[ORM\Column(name: 'type', type: Types::STRING, length: 32, nullable: true)]
    private ?string $type = null;

    #[ORM\Column(name: 'type_1', type: Types::STRING, length: 32, nullable: true)]
    private ?string $type1 = null;

    #[ORM\Column(name: 'categ', type: Types::STRING, length: 32, nullable: true)]
    private ?string $categ = null;

    #[ORM\Column(name: 'ex', type: Types::STRING, length: 8, nullable: true)]
    private ?string $ex = null;

    #[ORM\Column(name: 'dat_regl', type: Types::DATE_IMMUTABLE, nullable: true)]
    private ?\DateTimeImmutable $datRegl = null;

    #[ORM\Column(name: 'ordonnance', type: Types::STRING, length: 32, nullable: true)]
    private ?string $ordonnance = null;

    #[ORM\Column(name: 'n_regl', type: Types::STRING, length: 32, nullable: true)]
    private ?string $nRegl = null;

    #[ORM\Column(name: 'd_emis', type: Types::DATE_IMMUTABLE, nullable: true)]
    private ?\DateTimeImmutable $dEmis = null;

    #[ORM\Column(name: 'min', type: Types::STRING, length: 16, nullable: true)]
    private ?string $min = null;

    #[ORM\Column(name: 'l_min', type: Types::STRING, length: 255, nullable: true)]
    private ?string $lMin = null;

    #[ORM\Column(name: 'mission', type: Types::STRING, length: 32, nullable: true)]
    private ?string $mission = null;

    #[ORM\Column(name: 'l_mis', type: Types::STRING, length: 255, nullable: true)]
    private ?string $lMis = null;

    #[ORM\Column(name: 'prog', type: Types::STRING, length: 32, nullable: true)]
    private ?string $prog = null;

    #[ORM\Column(name: 'l_prog', type: Types::STRING, length: 255, nullable: true)]
    private ?string $lProg = null;

    #[ORM\Column(name: 'action', type: Types::STRING, length: 32, nullable: true)]
    private ?string $action = null;

    #[ORM\Column(name: 'titre', type: Types::STRING, length: 16, nullable: true)]
    private ?string $titre = null;

    #[ORM\Column(name: 'bop', type: Types::STRING, length: 32, nullable: true)]
    private ?string $bop = null;

    #[ORM\Column(name: 'l_bop', type: Types::STRING, length: 255, nullable: true)]
    private ?string $lBop = null;

    #[ORM\Column(name: 'uo', type: Types::STRING, length: 32, nullable: true)]
    private ?string $uo = null;

    #[ORM\Column(name: 'l_uo', type: Types::STRING, length: 255, nullable: true)]
    private ?string $lUo = null;

    #[ORM\Column(name: 'pc', type: Types::STRING, length: 16, nullable: true)]
    private ?string $pc = null;

    #[ORM\Column(name: 'lib_pc', type: Types::STRING, length: 255, nullable: true)]
    private ?string $libPc = null;

    #[ORM\Column(name: 'nat', type: Types::STRING, length: 16, nullable: true)]
    private ?string $nat = null;

    #[ORM\Column(name: 'nature', type: Types::STRING, length: 255, nullable: true)]
    private ?string $nature = null;

    #[ORM\Column(name: 'banque', type: Types::STRING, length: 64, nullable: true)]
    private ?string $banque = null;

    #[ORM\Column(name: 'mdr', type: Types::STRING, length: 16, nullable: true)]
    private ?string $mdr = null;

    #[ORM\Column(name: 'compte_banc', type: Types::STRING, length: 64, nullable: true)]
    private ?string $compteBanc = null;

    #[ORM\Column(name: 'matric', type: Types::STRING, length: 64, nullable: true)]
    private ?string $matric = null;

    #[ORM\Column(name: 'nom', type: Types::STRING, length: 255, nullable: true)]
    private ?string $nom = null;

    #[ORM\Column(name: 'm_regl', type: Types::DECIMAL, precision: 20, scale: 2, nullable: true)]
    private ?string $mRegl = null;

    #[ORM\Column(name: 'm_net', type: Types::DECIMAL, precision: 20, scale: 2, nullable: true)]
    private ?string $mNet = null;

    #[ORM\Column(name: 'm_prec_tva', type: Types::DECIMAL, precision: 20, scale: 2, nullable: true)]
    private ?string $mPrecTva = null;

    #[ORM\Column(name: 'n_mandat_tva', type: Types::STRING, length: 32, nullable: true)]
    private ?string $nMandatTva = null;

    #[ORM\Column(name: 'objet', type: Types::STRING, length: 500, nullable: true)]
    private ?string $objet = null;

    #[ORM\Column(name: 'num_bv', type: Types::STRING, length: 64, nullable: true)]
    private ?string $numBv = null;

    #[ORM\Column(name: 'n_cbanq', type: Types::STRING, length: 64, nullable: true)]
    private ?string $nCbanq = null;

    #[ORM\Column(name: 'd_eche', type: Types::DATE_IMMUTABLE, nullable: true)]
    private ?\DateTimeImmutable $dEche = null;

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

    public function getOrdonnance(): ?string
    {
        return $this->ordonnance;
    }

    public function getNRegl(): ?string
    {
        return $this->nRegl;
    }

    public function getDatRegl(): ?\DateTimeImmutable
    {
        return $this->datRegl;
    }

    public function getMRegl(): ?string
    {
        return $this->mRegl;
    }

    public function getType(): ?string
    {
        return $this->type;
    }

    public function getType1(): ?string
    {
        return $this->type1;
    }

    public function getCateg(): ?string
    {
        return $this->categ;
    }

    public function getEx(): ?string
    {
        return $this->ex;
    }

    public function getDEmis(): ?\DateTimeImmutable
    {
        return $this->dEmis;
    }

    public function getMin(): ?string
    {
        return $this->min;
    }

    public function getLMin(): ?string
    {
        return $this->lMin;
    }

    public function getMission(): ?string
    {
        return $this->mission;
    }

    public function getLMis(): ?string
    {
        return $this->lMis;
    }

    public function getProg(): ?string
    {
        return $this->prog;
    }

    public function getLProg(): ?string
    {
        return $this->lProg;
    }

    public function getTitre(): ?string
    {
        return $this->titre;
    }

    public function getNat(): ?string
    {
        return $this->nat;
    }

    public function getNature(): ?string
    {
        return $this->nature;
    }

    public function getMdr(): ?string
    {
        return $this->mdr;
    }

    public function getNom(): ?string
    {
        return $this->nom;
    }

    public function getObjet(): ?string
    {
        return $this->objet;
    }
}

