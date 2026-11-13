<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Entite\Recette;

use App\Module\ServiceOperationsFinancieres\Entite\Import\DcMandat;
use App\Module\ServiceOperationsFinancieres\Entite\Import\IgOperation;
use App\Module\ServiceOperationsFinancieres\Entite\Periode;
use App\Module\ServiceOperationsFinancieres\Enum\StatutTvaRapprochement;
use App\Module\ServiceOperationsFinancieres\Repository\TvaRapprochementRepository;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;

/**
 * Rapprochement TVA DC ↔ IG : un mandat DC (REGLE) et son opération IG éventuelle.
 */
#[ORM\Entity(repositoryClass: TvaRapprochementRepository::class)]
#[ORM\Table(name: 'sof_tva_rapprochement')]
#[ORM\Index(name: 'idx_sof_tva_rapprochement_periode', columns: ['periode_id'])]
#[ORM\Index(name: 'idx_sof_tva_rapprochement_dc_mandat', columns: ['dc_mandat_id'])]
#[ORM\Index(name: 'idx_sof_tva_rapprochement_ig_operation', columns: ['ig_operation_id'])]
#[ORM\Index(name: 'idx_sof_tva_rapprochement_statut', columns: ['periode_id', 'statut'])]
class TvaRapprochement
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column(name: 'id', type: Types::INTEGER)]
    private ?int $id = null;

    #[ORM\ManyToOne(targetEntity: Periode::class)]
    #[ORM\JoinColumn(name: 'periode_id', referencedColumnName: 'id', nullable: false, onDelete: 'CASCADE')]
    private Periode $periode;

    #[ORM\ManyToOne(targetEntity: DcMandat::class)]
    #[ORM\JoinColumn(name: 'dc_mandat_id', referencedColumnName: 'id', nullable: false, onDelete: 'CASCADE')]
    private DcMandat $dcMandat;

    #[ORM\ManyToOne(targetEntity: IgOperation::class)]
    #[ORM\JoinColumn(name: 'ig_operation_id', referencedColumnName: 'id', nullable: true, onDelete: 'SET NULL')]
    private ?IgOperation $igOperation = null;

    #[ORM\Column(name: 'statut', type: Types::STRING, length: 16, enumType: StatutTvaRapprochement::class)]
    private StatutTvaRapprochement $statut;

    #[ORM\Column(name: 'petrole', type: Types::BOOLEAN, options: ['default' => false])]
    private bool $petrole = false;

    public function __construct(
        Periode $periode,
        DcMandat $dcMandat,
        ?IgOperation $igOperation,
        StatutTvaRapprochement $statut,
        bool $petrole = false,
    ) {
        $this->periode = $periode;
        $this->dcMandat = $dcMandat;
        $this->igOperation = $igOperation;
        $this->statut = $statut;
        $this->petrole = $petrole;
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getPeriode(): Periode
    {
        return $this->periode;
    }

    public function getDcMandat(): DcMandat
    {
        return $this->dcMandat;
    }

    public function getIgOperation(): ?IgOperation
    {
        return $this->igOperation;
    }

    public function getStatut(): StatutTvaRapprochement
    {
        return $this->statut;
    }

    public function isPetrole(): bool
    {
        return $this->petrole;
    }
}
