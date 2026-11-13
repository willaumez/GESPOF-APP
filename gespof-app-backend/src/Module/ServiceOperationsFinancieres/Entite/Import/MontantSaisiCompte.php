<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Entite\Import;

use App\Module\ServiceOperationsFinancieres\Entite\Periode;
use App\Module\ServiceOperationsFinancieres\Enum\SensMontantCompte;
use App\Module\ServiceOperationsFinancieres\Repository\MontantSaisiCompteRepository;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;

/**
 * Montant agrégé / saisi par compte (plan — montant_saisi_compte).
 * Unique (periode, compte, sens). Ex. RUSID 4663-218 · F8.
 */
#[ORM\Entity(repositoryClass: MontantSaisiCompteRepository::class)]
#[ORM\Table(name: 'sof_montant_saisi_compte')]
#[ORM\UniqueConstraint(
    name: 'uniq_sof_montant_saisi_compte',
    columns: ['periode_id', 'compte', 'sens'],
)]
#[ORM\Index(name: 'idx_sof_montant_saisi_compte_periode', columns: ['periode_id'])]
class MontantSaisiCompte
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column(name: 'id', type: Types::INTEGER)]
    private ?int $id = null;

    #[ORM\ManyToOne(targetEntity: Periode::class)]
    #[ORM\JoinColumn(name: 'periode_id', referencedColumnName: 'id', nullable: false, onDelete: 'CASCADE')]
    private Periode $periode;

    #[ORM\Column(name: 'compte', type: Types::STRING, length: 32)]
    private string $compte;

    #[ORM\Column(name: 'sens', type: Types::STRING, length: 16, enumType: SensMontantCompte::class)]
    private SensMontantCompte $sens;

    #[ORM\Column(name: 'montant', type: Types::DECIMAL, precision: 20, scale: 2)]
    private string $montant = '0.00';

    #[ORM\Column(name: 'source', type: Types::STRING, length: 64, nullable: true)]
    private ?string $source = null;

    public function __construct(
        Periode $periode,
        string $compte,
        SensMontantCompte $sens,
        string $montant = '0.00',
        ?string $source = null,
    ) {
        $this->periode = $periode;
        $this->compte = $compte;
        $this->sens = $sens;
        $this->montant = $montant;
        $this->source = $source;
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getPeriode(): Periode
    {
        return $this->periode;
    }

    public function getCompte(): string
    {
        return $this->compte;
    }

    public function getSens(): SensMontantCompte
    {
        return $this->sens;
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

    public function getSource(): ?string
    {
        return $this->source;
    }

    public function setSource(?string $source): static
    {
        $this->source = $source;

        return $this;
    }
}
