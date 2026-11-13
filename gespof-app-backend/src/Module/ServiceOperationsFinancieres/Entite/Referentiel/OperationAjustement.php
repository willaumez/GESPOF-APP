<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Entite\Referentiel;

use App\Module\ServiceOperationsFinancieres\Entite\Periode;
use App\Module\ServiceOperationsFinancieres\Enum\NatureAjustement;
use App\Module\ServiceOperationsFinancieres\Repository\OperationAjustementRepository;
use App\Shared\Entite\Utilisateur;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;

/**
 * Ajustement manuel (SPEC §7 — operation_ajustement).
 * Pas de suppression : contre-passation liée à l'opération d'origine.
 */
#[ORM\Entity(repositoryClass: OperationAjustementRepository::class)]
#[ORM\Table(name: 'sof_operation_ajustement')]
#[ORM\Index(name: 'idx_sof_op_ajust_periode', columns: ['periode_id'])]
#[ORM\Index(name: 'idx_sof_op_ajust_code_srot', columns: ['code_srot', 'periode_id'])]
class OperationAjustement
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column(name: 'id', type: Types::INTEGER)]
    private ?int $id = null;

    #[ORM\ManyToOne(targetEntity: Periode::class)]
    #[ORM\JoinColumn(name: 'periode_id', referencedColumnName: 'id', nullable: false, onDelete: 'RESTRICT')]
    private Periode $periode;

    #[ORM\Column(name: 'date_operation', type: Types::DATE_IMMUTABLE)]
    private \DateTimeImmutable $dateOperation;

    #[ORM\Column(name: 'nature', type: Types::STRING, length: 16, enumType: NatureAjustement::class)]
    private NatureAjustement $nature;

    /** Code cascade EnregistrementOP (ex. 2B11). */
    #[ORM\Column(name: 'code_ajustement', type: Types::STRING, length: 32)]
    private string $codeAjustement;

    /** Code SROT impacté (correspondance-ajustements). */
    #[ORM\Column(name: 'code_srot', type: Types::STRING, length: 16, nullable: true)]
    private ?string $codeSrot = null;

    #[ORM\Column(name: 'libelle', type: Types::STRING, length: 255, nullable: true)]
    private ?string $libelle = null;

    /** Montant signé en FCFA (positif augmente, négatif réduit). */
    #[ORM\Column(name: 'montant', type: Types::DECIMAL, precision: 20, scale: 2)]
    private string $montant = '0.00';

    #[ORM\Column(name: 'motif', type: Types::STRING, length: 500)]
    private string $motif;

    #[ORM\ManyToOne(targetEntity: self::class)]
    #[ORM\JoinColumn(name: 'contre_passation_de_id', referencedColumnName: 'id', nullable: true, onDelete: 'RESTRICT')]
    private ?self $contrePassationDe = null;

    #[ORM\ManyToOne(targetEntity: Utilisateur::class)]
    #[ORM\JoinColumn(name: 'cree_par_id', referencedColumnName: 'id', nullable: true, onDelete: 'SET NULL')]
    private ?Utilisateur $creePar = null;

    #[ORM\Column(name: 'cree_le', type: Types::DATETIME_IMMUTABLE)]
    private \DateTimeImmutable $creeLe;

    public function __construct(
        Periode $periode,
        \DateTimeImmutable $dateOperation,
        NatureAjustement $nature,
        string $codeAjustement,
        string $montant,
        string $motif,
        ?string $codeSrot = null,
        ?string $libelle = null,
        ?Utilisateur $creePar = null,
    ) {
        $this->periode = $periode;
        $this->dateOperation = $dateOperation;
        $this->nature = $nature;
        $this->codeAjustement = trim($codeAjustement);
        $this->montant = $montant;
        $this->motif = trim($motif);
        $this->codeSrot = $codeSrot !== null && trim($codeSrot) !== '' ? trim($codeSrot) : null;
        $this->libelle = $libelle;
        $this->creePar = $creePar;
        $this->creeLe = new \DateTimeImmutable();
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getPeriode(): Periode
    {
        return $this->periode;
    }

    public function getDateOperation(): \DateTimeImmutable
    {
        return $this->dateOperation;
    }

    public function getNature(): NatureAjustement
    {
        return $this->nature;
    }

    public function getCodeAjustement(): string
    {
        return $this->codeAjustement;
    }

    public function getCodeSrot(): ?string
    {
        return $this->codeSrot;
    }

    public function getLibelle(): ?string
    {
        return $this->libelle;
    }

    public function getMontant(): string
    {
        return $this->montant;
    }

    public function getMotif(): string
    {
        return $this->motif;
    }

    public function getContrePassationDe(): ?self
    {
        return $this->contrePassationDe;
    }

    public function setContrePassationDe(?self $origine): static
    {
        $this->contrePassationDe = $origine;

        return $this;
    }

    public function getCreePar(): ?Utilisateur
    {
        return $this->creePar;
    }

    public function getCreeLe(): \DateTimeImmutable
    {
        return $this->creeLe;
    }

    public function reference(): string
    {
        $id = $this->id ?? 0;
        $annee = $this->periode->getExercice()->getAnnee();
        $mois = $this->periode->getMois();

        return sprintf('AD-%d-%02d-%03d', $annee, $mois, $id);
    }
}
