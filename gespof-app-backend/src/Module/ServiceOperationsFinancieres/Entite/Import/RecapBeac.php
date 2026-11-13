<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Entite\Import;

use App\Module\ServiceOperationsFinancieres\Repository\RecapBeacRepository;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;

/**
 * Ligne du récapitulatif BEAC (plan phase 1 — table recap_beac, format F7).
 */
#[ORM\Entity(repositoryClass: RecapBeacRepository::class)]
#[ORM\Table(name: 'sof_recap_beac')]
#[ORM\Index(name: 'idx_sof_recap_beac_lot', columns: ['lot_id'])]
#[ORM\Index(name: 'idx_sof_recap_beac_code', columns: ['code'])]
class RecapBeac
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column(name: 'id', type: Types::INTEGER)]
    private ?int $id = null;

    #[ORM\ManyToOne(targetEntity: LotImport::class)]
    #[ORM\JoinColumn(name: 'lot_id', referencedColumnName: 'id', nullable: false, onDelete: 'CASCADE')]
    private LotImport $lot;

    #[ORM\Column(name: 'code', type: Types::STRING, length: 32)]
    private string $code;

    #[ORM\Column(name: 'type_recette', type: Types::STRING, length: 255)]
    private string $typeRecette;

    #[ORM\Column(name: 'montant', type: Types::DECIMAL, precision: 20, scale: 2)]
    private string $montant;

    public function __construct(LotImport $lot, string $code, string $typeRecette, string $montant)
    {
        $this->lot = $lot;
        $this->code = $code;
        $this->typeRecette = $typeRecette;
        $this->montant = $montant;
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getLot(): LotImport
    {
        return $this->lot;
    }

    public function getCode(): string
    {
        return $this->code;
    }

    public function getTypeRecette(): string
    {
        return $this->typeRecette;
    }

    public function getMontant(): string
    {
        return $this->montant;
    }
}
