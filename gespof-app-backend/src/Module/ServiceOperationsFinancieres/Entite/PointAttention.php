<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Entite;

use App\Module\ServiceOperationsFinancieres\Enum\PointAttentionCode;
use App\Module\ServiceOperationsFinancieres\Repository\PointAttentionRepository;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;

/**
 * Case cochée de l'annexe SROT « Points d'attention ».
 */
#[ORM\Entity(repositoryClass: PointAttentionRepository::class)]
#[ORM\Table(name: 'sof_point_attention')]
#[ORM\UniqueConstraint(name: 'uniq_sof_point_attention_periode_code', columns: ['periode_id', 'code'])]
#[ORM\Index(name: 'idx_sof_point_attention_periode', columns: ['periode_id'])]
class PointAttention
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column(name: 'id', type: Types::INTEGER)]
    private ?int $id = null;

    #[ORM\ManyToOne(targetEntity: Periode::class)]
    #[ORM\JoinColumn(name: 'periode_id', referencedColumnName: 'id', nullable: false, onDelete: 'CASCADE')]
    private Periode $periode;

    #[ORM\Column(name: 'code', type: Types::STRING, length: 32, enumType: PointAttentionCode::class)]
    private PointAttentionCode $code;

    #[ORM\Column(name: 'coche', type: Types::BOOLEAN)]
    private bool $coche = false;

    #[ORM\Column(name: 'coche_le', type: Types::DATETIME_IMMUTABLE, nullable: true)]
    private ?\DateTimeImmutable $cocheLe = null;

    public function __construct(Periode $periode, PointAttentionCode $code)
    {
        $this->periode = $periode;
        $this->code = $code;
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getPeriode(): Periode
    {
        return $this->periode;
    }

    public function getCode(): PointAttentionCode
    {
        return $this->code;
    }

    public function isCoche(): bool
    {
        return $this->coche;
    }

    public function setCoche(bool $coche): static
    {
        $this->coche = $coche;
        $this->cocheLe = $coche ? new \DateTimeImmutable() : null;

        return $this;
    }

    public function getCocheLe(): ?\DateTimeImmutable
    {
        return $this->cocheLe;
    }
}
