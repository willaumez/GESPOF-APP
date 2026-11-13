<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Entite\Recette;

use App\Module\ServiceOperationsFinancieres\Entite\Periode;
use App\Module\ServiceOperationsFinancieres\Enum\ModeRecouvrement;
use App\Module\ServiceOperationsFinancieres\Repository\RecetteFiscaleModeRepository;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;

/**
 * Recette fiscale (DGI) par rubrique et mode de recouvrement.
 * Unique (période, rubrique, mode).
 */
#[ORM\Entity(repositoryClass: RecetteFiscaleModeRepository::class)]
#[ORM\Table(name: 'sof_recette_fiscale_mode')]
#[ORM\UniqueConstraint(name: 'uniq_sof_recette_fiscale_mode', columns: ['periode_id', 'rubrique_code', 'mode'])]
#[ORM\Index(name: 'idx_sof_recette_fiscale_mode_periode', columns: ['periode_id'])]
class RecetteFiscaleMode
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column(name: 'id', type: Types::INTEGER)]
    private ?int $id = null;

    #[ORM\ManyToOne(targetEntity: Periode::class)]
    #[ORM\JoinColumn(name: 'periode_id', referencedColumnName: 'id', nullable: false, onDelete: 'CASCADE')]
    private Periode $periode;

    #[ORM\Column(name: 'rubrique_code', type: Types::STRING, length: 16)]
    private string $rubriqueCode;

    #[ORM\Column(name: 'mode', type: Types::STRING, length: 16, enumType: ModeRecouvrement::class)]
    private ModeRecouvrement $mode;

    #[ORM\Column(name: 'montant', type: Types::DECIMAL, precision: 20, scale: 2, options: ['default' => '0.00'])]
    private string $montant = '0.00';

    public function __construct(
        Periode $periode,
        string $rubriqueCode,
        ModeRecouvrement $mode,
        string $montant = '0.00',
    ) {
        $this->periode = $periode;
        $this->rubriqueCode = $rubriqueCode;
        $this->mode = $mode;
        $this->montant = $montant;
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getPeriode(): Periode
    {
        return $this->periode;
    }

    public function getRubriqueCode(): string
    {
        return $this->rubriqueCode;
    }

    public function getMode(): ModeRecouvrement
    {
        return $this->mode;
    }

    public function getMontant(): string
    {
        return $this->montant;
    }

    public function setMontant(string $montant): static
    {
        $this->montant = $montant;

        return $this;
    }
}
