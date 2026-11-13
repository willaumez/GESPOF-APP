<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Entite\Extraction;

use App\Module\ServiceOperationsFinancieres\Entite\Import\LotImport;
use App\Module\ServiceOperationsFinancieres\Repository\ExtractionElementRepository;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity(repositoryClass: ExtractionElementRepository::class)]
#[ORM\Table(name: 'sof_extraction_element')]
#[ORM\Index(name: 'idx_sof_ext_el_lanc', columns: ['lancement_id'])]
class ExtractionElement
{
    public const EN_ATTENTE = 'EN_ATTENTE';
    public const EN_COURS = 'EN_COURS';
    public const TERMINE = 'TERMINE';
    public const ERREUR = 'ERREUR';
    public const IGNORE = 'IGNORE';
    public const ANNULE = 'ANNULE';

    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column(type: Types::INTEGER)]
    private ?int $id = null;

    #[ORM\ManyToOne(targetEntity: ExtractionLancement::class, inversedBy: 'elements')]
    #[ORM\JoinColumn(name: 'lancement_id', referencedColumnName: 'id', nullable: false, onDelete: 'CASCADE')]
    private ExtractionLancement $lancement;

    #[ORM\ManyToOne(targetEntity: self::class)]
    #[ORM\JoinColumn(name: 'parent_id', referencedColumnName: 'id', nullable: true, onDelete: 'CASCADE')]
    private ?self $parent = null;

    #[ORM\Column(type: Types::INTEGER)]
    private int $ordre = 0;

    #[ORM\Column(name: 'code_preset', type: Types::STRING, length: 64, nullable: true)]
    private ?string $codePreset = null;

    #[ORM\Column(type: Types::STRING, length: 32, nullable: true)]
    private ?string $compte = null;

    #[ORM\Column(type: Types::STRING, length: 16, nullable: true)]
    private ?string $nature = null;

    #[ORM\Column(type: Types::STRING, length: 255)]
    private string $titre;

    #[ORM\Column(type: Types::STRING, length: 16)]
    private string $statut = self::EN_ATTENTE;

    #[ORM\Column(name: 'lignes_traitees', type: Types::INTEGER, nullable: true)]
    private ?int $lignesTraitees = null;

    #[ORM\Column(name: 'lignes_a_extraire', type: Types::INTEGER, nullable: true)]
    private ?int $lignesAExtraire = null;

    #[ORM\Column(type: Types::INTEGER)]
    private int $pourcentage = 0;

    #[ORM\Column(type: Types::STRING, length: 500, nullable: true)]
    private ?string $message = null;

    #[ORM\ManyToOne(targetEntity: LotImport::class)]
    #[ORM\JoinColumn(name: 'lot_id', referencedColumnName: 'id', nullable: true, onDelete: 'SET NULL')]
    private ?LotImport $lot = null;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE, nullable: true)]
    private ?\DateTimeImmutable $debut = null;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE, nullable: true)]
    private ?\DateTimeImmutable $fin = null;

    public function __construct(string $titre, int $ordre = 0)
    {
        $this->titre = $titre;
        $this->ordre = $ordre;
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function setLancement(ExtractionLancement $lancement): static
    {
        $this->lancement = $lancement;

        return $this;
    }

    public function getLancement(): ExtractionLancement
    {
        return $this->lancement;
    }

    public function getParent(): ?self
    {
        return $this->parent;
    }

    public function setParent(?self $parent): static
    {
        $this->parent = $parent;

        return $this;
    }

    public function getOrdre(): int
    {
        return $this->ordre;
    }

    public function getCodePreset(): ?string
    {
        return $this->codePreset;
    }

    public function setCodePreset(?string $codePreset): static
    {
        $this->codePreset = $codePreset;

        return $this;
    }

    public function getCompte(): ?string
    {
        return $this->compte;
    }

    public function setCompte(?string $compte): static
    {
        $this->compte = $compte;

        return $this;
    }

    public function getNature(): ?string
    {
        return $this->nature;
    }

    public function setNature(?string $nature): static
    {
        $this->nature = $nature;

        return $this;
    }

    public function getTitre(): string
    {
        return $this->titre;
    }

    public function getStatut(): string
    {
        return $this->statut;
    }

    public function setStatut(string $statut): static
    {
        $this->statut = $statut;

        return $this;
    }

    public function getLignesTraitees(): ?int
    {
        return $this->lignesTraitees;
    }

    public function setLignesTraitees(?int $n): static
    {
        $this->lignesTraitees = $n;

        return $this;
    }

    public function getLignesAExtraire(): ?int
    {
        return $this->lignesAExtraire;
    }

    public function setLignesAExtraire(?int $n): static
    {
        $this->lignesAExtraire = $n;

        return $this;
    }

    public function getPourcentage(): int
    {
        return $this->pourcentage;
    }

    public function setPourcentage(int $p): static
    {
        $this->pourcentage = max(0, min(100, $p));

        return $this;
    }

    public function getMessage(): ?string
    {
        return $this->message;
    }

    public function setMessage(?string $message): static
    {
        $this->message = $message;

        return $this;
    }

    public function getLot(): ?LotImport
    {
        return $this->lot;
    }

    public function setLot(?LotImport $lot): static
    {
        $this->lot = $lot;

        return $this;
    }

    public function getDebut(): ?\DateTimeImmutable
    {
        return $this->debut;
    }

    public function setDebut(?\DateTimeImmutable $debut): static
    {
        $this->debut = $debut;

        return $this;
    }

    public function getFin(): ?\DateTimeImmutable
    {
        return $this->fin;
    }

    public function setFin(?\DateTimeImmutable $fin): static
    {
        $this->fin = $fin;

        return $this;
    }
}
