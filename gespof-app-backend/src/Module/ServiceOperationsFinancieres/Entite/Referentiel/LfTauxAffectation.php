<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Entite\Referentiel;

use App\Module\ServiceOperationsFinancieres\Repository\LfTauxAffectationRepository;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity(repositoryClass: LfTauxAffectationRepository::class)]
#[ORM\Table(name: 'sof_lf_taux_affectation')]
#[ORM\Index(name: 'idx_sof_lf_taux_affectation_loi', columns: ['loi_id'])]
class LfTauxAffectation
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column(name: 'id', type: Types::INTEGER)]
    private ?int $id = null;

    #[ORM\ManyToOne(targetEntity: LoiFinances::class, inversedBy: 'tauxAffectations')]
    #[ORM\JoinColumn(name: 'loi_id', referencedColumnName: 'id', nullable: false, onDelete: 'CASCADE')]
    private ?LoiFinances $loi = null;

    #[ORM\Column(name: 'rubrique_code', type: Types::STRING, length: 16)]
    private string $rubriqueCode;

    #[ORM\Column(name: 'beneficiaire', type: Types::STRING, length: 255)]
    private string $beneficiaire;

    #[ORM\Column(name: 'nature', type: Types::STRING, length: 128)]
    private string $nature;

    /** Taux décimal (0.074 = 7,4 %). */
    #[ORM\Column(name: 'taux', type: Types::DECIMAL, precision: 10, scale: 6)]
    private string $taux = '0.000000';

    public function __construct(
        string $rubriqueCode,
        string $beneficiaire,
        string $nature,
        string $taux = '0',
    ) {
        $this->rubriqueCode = $rubriqueCode;
        $this->beneficiaire = $beneficiaire;
        $this->nature = $nature;
        $this->taux = self::normaliserTaux($taux);
    }

    private static function normaliserTaux(string $taux): string
    {
        if (!is_numeric($taux)) {
            throw new \InvalidArgumentException(sprintf('Taux invalide : "%s".', $taux));
        }

        return bcadd($taux, '0', 6);
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

    public function getBeneficiaire(): string
    {
        return $this->beneficiaire;
    }

    public function getNature(): string
    {
        return $this->nature;
    }

    public function getTaux(): string
    {
        return $this->taux;
    }

    public function setTaux(string $taux): static
    {
        $this->taux = self::normaliserTaux($taux);

        return $this;
    }
}
