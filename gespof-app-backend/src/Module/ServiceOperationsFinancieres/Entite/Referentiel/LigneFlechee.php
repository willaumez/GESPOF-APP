<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Entite\Referentiel;

use App\Module\ServiceOperationsFinancieres\Entite\Periode;
use App\Module\ServiceOperationsFinancieres\Repository\LigneFlecheeRepository;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;

/**
 * Lien d'une ligne source vers une rubrique (plan phase 1 — ligne_flechee).
 */
#[ORM\Entity(repositoryClass: LigneFlecheeRepository::class)]
#[ORM\Table(name: 'sof_ligne_flechee')]
#[ORM\Index(name: 'idx_sof_ligne_flechee_rubrique_periode', columns: ['rubrique_code', 'periode_id'])]
#[ORM\Index(name: 'idx_sof_ligne_flechee_source', columns: ['source_table', 'source_id'])]
class LigneFlechee
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column(name: 'id', type: Types::INTEGER)]
    private ?int $id = null;

    #[ORM\Column(name: 'source_table', type: Types::STRING, length: 64)]
    private string $sourceTable;

    #[ORM\Column(name: 'source_id', type: Types::STRING, length: 64)]
    private string $sourceId;

    #[ORM\ManyToOne(targetEntity: Periode::class)]
    #[ORM\JoinColumn(name: 'periode_id', referencedColumnName: 'id', nullable: false, onDelete: 'CASCADE')]
    private Periode $periode;

    #[ORM\Column(name: 'rubrique_code', type: Types::STRING, length: 16)]
    private string $rubriqueCode;

    #[ORM\Column(name: 'mois', type: Types::INTEGER)]
    private int $mois;

    #[ORM\Column(name: 'montant', type: Types::DECIMAL, precision: 20, scale: 2)]
    private string $montant = '0.00';

    #[ORM\Column(name: 'regle_id', type: Types::INTEGER, nullable: true)]
    private ?int $regleId = null;

    public function __construct(
        string $sourceTable,
        string $sourceId,
        Periode $periode,
        string $rubriqueCode,
        int $mois,
        string $montant,
        ?int $regleId = null,
    ) {
        $this->sourceTable = $sourceTable;
        $this->sourceId = $sourceId;
        $this->periode = $periode;
        $this->rubriqueCode = $rubriqueCode;
        $this->mois = $mois;
        $this->montant = $montant;
        $this->regleId = $regleId;
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getSourceTable(): string
    {
        return $this->sourceTable;
    }

    public function getSourceId(): string
    {
        return $this->sourceId;
    }

    public function getPeriode(): Periode
    {
        return $this->periode;
    }

    public function getRubriqueCode(): string
    {
        return $this->rubriqueCode;
    }

    public function getMois(): int
    {
        return $this->mois;
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

    public function getRegleId(): ?int
    {
        return $this->regleId;
    }
}
