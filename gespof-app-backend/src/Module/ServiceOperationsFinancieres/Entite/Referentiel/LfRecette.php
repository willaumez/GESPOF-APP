<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Entite\Referentiel;

use App\Module\ServiceOperationsFinancieres\Repository\LfRecetteRepository;
use App\Module\ServiceOperationsFinancieres\Support\Montant;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity(repositoryClass: LfRecetteRepository::class)]
#[ORM\Table(name: 'sof_lf_recette')]
#[ORM\UniqueConstraint(name: 'uniq_sof_lf_recette_loi_rubrique', columns: ['loi_id', 'rubrique_code'])]
class LfRecette
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column(name: 'id', type: Types::INTEGER)]
    private ?int $id = null;

    #[ORM\ManyToOne(targetEntity: LoiFinances::class, inversedBy: 'recettes')]
    #[ORM\JoinColumn(name: 'loi_id', referencedColumnName: 'id', nullable: false, onDelete: 'CASCADE')]
    private ?LoiFinances $loi = null;

    #[ORM\Column(name: 'rubrique_code', type: Types::STRING, length: 16)]
    private string $rubriqueCode;

    #[ORM\Column(name: 'libelle', type: Types::STRING, length: 255)]
    private string $libelle;

    #[ORM\Column(name: 'montant', type: Types::DECIMAL, precision: 20, scale: 2)]
    private string $montant = '0.00';

    public function __construct(string $rubriqueCode, string $libelle, string $montant = '0.00')
    {
        $this->rubriqueCode = $rubriqueCode;
        $this->libelle = $libelle;
        $this->montant = Montant::normaliser($montant);
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

    public function getRubriqueCode(): string
    {
        return $this->rubriqueCode;
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
}
