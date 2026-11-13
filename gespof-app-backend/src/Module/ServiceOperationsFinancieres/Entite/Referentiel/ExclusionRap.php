<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Entite\Referentiel;

use App\Module\ServiceOperationsFinancieres\Repository\ExclusionRapRepository;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity(repositoryClass: ExclusionRapRepository::class)]
#[ORM\Table(name: 'sof_exclusion_rap')]
#[ORM\Index(name: 'idx_sof_exclusion_rap_type', columns: ['type'])]
class ExclusionRap
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column(name: 'id', type: Types::INTEGER)]
    private ?int $id = null;

    /** ORDONNANCE | MDR | NATURE */
    #[ORM\Column(name: 'type', type: Types::STRING, length: 16)]
    private string $type;

    #[ORM\Column(name: 'code', type: Types::STRING, length: 64)]
    private string $code;

    #[ORM\Column(name: 'libelle', type: Types::STRING, length: 255, nullable: true)]
    private ?string $libelle = null;

    #[ORM\Column(name: 'motif', type: Types::STRING, length: 500, nullable: true)]
    private ?string $motif = null;

    #[ORM\Column(name: 'date_exclusion', type: Types::DATE_MUTABLE, nullable: true)]
    private ?\DateTimeInterface $dateExclusion = null;

    #[ORM\Column(name: 'auteur', type: Types::STRING, length: 128, nullable: true)]
    private ?string $auteur = null;

    /** RAP_AVANT_BOP | RAP_MODE_BOP | TOUTES */
    #[ORM\Column(name: 'portee', type: Types::STRING, length: 32, nullable: true)]
    private ?string $portee = null;

    public function __construct(string $type, string $code)
    {
        $this->type = $type;
        $this->code = $code;
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getType(): string
    {
        return $this->type;
    }

    public function getCode(): string
    {
        return $this->code;
    }

    public function setCode(string $code): static
    {
        $this->code = $code;

        return $this;
    }

    public function getLibelle(): ?string
    {
        return $this->libelle;
    }

    public function setLibelle(?string $libelle): static
    {
        $this->libelle = $libelle;

        return $this;
    }

    public function getMotif(): ?string
    {
        return $this->motif;
    }

    public function setMotif(?string $motif): static
    {
        $this->motif = $motif;

        return $this;
    }

    public function getDateExclusion(): ?\DateTimeInterface
    {
        return $this->dateExclusion;
    }

    public function setDateExclusion(?\DateTimeInterface $dateExclusion): static
    {
        $this->dateExclusion = $dateExclusion;

        return $this;
    }

    public function getAuteur(): ?string
    {
        return $this->auteur;
    }

    public function setAuteur(?string $auteur): static
    {
        $this->auteur = $auteur;

        return $this;
    }

    public function getPortee(): ?string
    {
        return $this->portee;
    }

    public function setPortee(?string $portee): static
    {
        $this->portee = $portee !== null && trim($portee) !== '' ? trim($portee) : null;

        return $this;
    }
}
