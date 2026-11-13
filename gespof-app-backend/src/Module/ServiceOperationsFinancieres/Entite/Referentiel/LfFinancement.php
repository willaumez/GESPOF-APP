<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Entite\Referentiel;

use App\Module\ServiceOperationsFinancieres\Repository\LfFinancementRepository;
use App\Module\ServiceOperationsFinancieres\Support\Montant;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity(repositoryClass: LfFinancementRepository::class)]
#[ORM\Table(name: 'sof_lf_financement')]
#[ORM\Index(name: 'idx_sof_lf_financement_loi', columns: ['loi_id'])]
class LfFinancement
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column(name: 'id', type: Types::INTEGER)]
    private ?int $id = null;

    #[ORM\ManyToOne(targetEntity: LoiFinances::class, inversedBy: 'financements')]
    #[ORM\JoinColumn(name: 'loi_id', referencedColumnName: 'id', nullable: false, onDelete: 'CASCADE')]
    private ?LoiFinances $loi = null;

    #[ORM\Column(name: 'code', type: Types::STRING, length: 32)]
    private string $code;

    #[ORM\Column(name: 'libelle', type: Types::STRING, length: 255)]
    private string $libelle;

    #[ORM\Column(name: 'montant', type: Types::DECIMAL, precision: 20, scale: 2)]
    private string $montant = '0.00';

    #[ORM\Column(name: 'ordre', type: Types::INTEGER)]
    private int $ordre = 0;

    public function __construct(string $code, string $libelle, string $montant = '0.00', int $ordre = 0)
    {
        $this->code = $code;
        $this->libelle = $libelle;
        $this->montant = Montant::normaliser($montant);
        $this->ordre = $ordre;
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

    public function getCode(): string
    {
        return $this->code;
    }

    public function getLibelle(): string
    {
        return $this->libelle;
    }

    public function setLibelle(string $libelle): static
    {
        $this->libelle = $libelle;

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

    public function getOrdre(): int
    {
        return $this->ordre;
    }

    public function setOrdre(int $ordre): static
    {
        $this->ordre = $ordre;

        return $this;
    }
}
