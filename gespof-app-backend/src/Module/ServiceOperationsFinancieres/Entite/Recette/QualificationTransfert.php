<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Entite\Recette;

use App\Module\ServiceOperationsFinancieres\Entite\Import\IgOperation;
use App\Module\ServiceOperationsFinancieres\Enum\TypeRecetteTransfert;
use App\Module\ServiceOperationsFinancieres\Repository\QualificationTransfertRepository;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;

/**
 * Qualification d'un transfert 1812-201 (plan phase 1 — qualification_transfert).
 * PK = ig_operation_id.
 */
#[ORM\Entity(repositoryClass: QualificationTransfertRepository::class)]
#[ORM\Table(name: 'sof_qualification_transfert')]
#[ORM\Index(name: 'idx_sof_qualif_transfert_type', columns: ['type_recette'])]
#[ORM\Index(name: 'idx_sof_qualif_transfert_societe', columns: ['societe_matricule'])]
class QualificationTransfert
{
    #[ORM\Id]
    #[ORM\OneToOne(targetEntity: IgOperation::class)]
    #[ORM\JoinColumn(name: 'ig_operation_id', referencedColumnName: 'id', nullable: false, onDelete: 'CASCADE')]
    private IgOperation $operation;

    #[ORM\Column(name: 'type_recette', type: Types::STRING, length: 32, enumType: TypeRecetteTransfert::class)]
    private TypeRecetteTransfert $typeRecette = TypeRecetteTransfert::NON_QUALIFIE;

    #[ORM\Column(name: 'societe_matricule', type: Types::STRING, length: 32, nullable: true)]
    private ?string $societeMatricule = null;

    #[ORM\Column(name: 'verifie_bgfi', type: Types::BOOLEAN, options: ['default' => false])]
    private bool $verifieBgfi = false;

    #[ORM\Column(name: 'exclu', type: Types::BOOLEAN, options: ['default' => false])]
    private bool $exclu = false;

    #[ORM\Column(name: 'motif', type: Types::STRING, length: 500, nullable: true)]
    private ?string $motif = null;

    #[ORM\Column(name: 'par', type: Types::STRING, length: 255, nullable: true)]
    private ?string $par = null;

    #[ORM\Column(name: 'le', type: Types::DATETIME_IMMUTABLE, nullable: true)]
    private ?\DateTimeImmutable $le = null;

    public function __construct(IgOperation $operation)
    {
        $this->operation = $operation;
    }

    public function getOperation(): IgOperation
    {
        return $this->operation;
    }

    public function getIgOperationId(): ?int
    {
        return $this->operation->getId();
    }

    public function getTypeRecette(): TypeRecetteTransfert
    {
        return $this->typeRecette;
    }

    public function setTypeRecette(TypeRecetteTransfert $typeRecette): static
    {
        $this->typeRecette = $typeRecette;

        return $this;
    }

    public function getSocieteMatricule(): ?string
    {
        return $this->societeMatricule;
    }

    public function setSocieteMatricule(?string $societeMatricule): static
    {
        $this->societeMatricule = $societeMatricule;

        return $this;
    }

    public function isVerifieBgfi(): bool
    {
        return $this->verifieBgfi;
    }

    public function setVerifieBgfi(bool $verifieBgfi): static
    {
        $this->verifieBgfi = $verifieBgfi;

        return $this;
    }

    public function isExclu(): bool
    {
        return $this->exclu;
    }

    public function setExclu(bool $exclu): static
    {
        $this->exclu = $exclu;

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

    public function getPar(): ?string
    {
        return $this->par;
    }

    public function setPar(?string $par): static
    {
        $this->par = $par;

        return $this;
    }

    public function getLe(): ?\DateTimeImmutable
    {
        return $this->le;
    }

    public function setLe(?\DateTimeImmutable $le): static
    {
        $this->le = $le;

        return $this;
    }
}
