<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Entite\Import;

use App\Module\ServiceOperationsFinancieres\Repository\AnomalieImportRepository;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;

/**
 * Anomalie détectée sur une ligne d'un lot d'import.
 */
#[ORM\Entity(repositoryClass: AnomalieImportRepository::class)]
#[ORM\Table(name: 'sof_anomalie_import')]
#[ORM\Index(name: 'idx_sof_anomalie_import_lot', columns: ['lot_id'])]
class AnomalieImport
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column(name: 'id', type: Types::INTEGER)]
    private ?int $id = null;

    #[ORM\ManyToOne(targetEntity: LotImport::class, inversedBy: 'anomalies')]
    #[ORM\JoinColumn(name: 'lot_id', referencedColumnName: 'id', nullable: false, onDelete: 'CASCADE')]
    private LotImport $lot;

    #[ORM\Column(name: 'ligne', type: Types::INTEGER)]
    private int $ligne;

    #[ORM\Column(name: 'colonne', type: Types::STRING, length: 64, nullable: true)]
    private ?string $colonne = null;

    #[ORM\Column(name: 'motif', type: Types::STRING, length: 500)]
    private string $motif;

    public function __construct(LotImport $lot, int $ligne, string $motif, ?string $colonne = null)
    {
        $this->lot = $lot;
        $this->ligne = $ligne;
        $this->motif = $motif;
        $this->colonne = $colonne;
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getLot(): LotImport
    {
        return $this->lot;
    }

    public function setLot(LotImport $lot): static
    {
        $this->lot = $lot;

        return $this;
    }

    public function getLigne(): int
    {
        return $this->ligne;
    }

    public function getColonne(): ?string
    {
        return $this->colonne;
    }

    public function getMotif(): string
    {
        return $this->motif;
    }
}
