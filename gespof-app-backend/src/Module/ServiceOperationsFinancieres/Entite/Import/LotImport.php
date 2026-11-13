<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Entite\Import;

use App\Module\ServiceOperationsFinancieres\Entite\Periode;
use App\Module\ServiceOperationsFinancieres\Enum\FormatImport;
use App\Module\ServiceOperationsFinancieres\Enum\StatutLotImport;
use App\Module\ServiceOperationsFinancieres\Repository\LotImportRepository;
use App\Shared\Entite\Utilisateur;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;

/**
 * Lot d'import (plan phase 0 — table lot_import).
 * Un seul lot ACTIF par (période, format, paramètres).
 */
#[ORM\Entity(repositoryClass: LotImportRepository::class)]
#[ORM\Table(name: 'sof_lot_import')]
#[ORM\Index(name: 'idx_sof_lot_import_periode', columns: ['periode_id'])]
#[ORM\Index(name: 'idx_sof_lot_import_statut', columns: ['statut'])]
#[ORM\Index(name: 'idx_sof_lot_import_importe_le', columns: ['importe_le'])]
class LotImport
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column(name: 'id', type: Types::INTEGER)]
    private ?int $id = null;

    #[ORM\ManyToOne(targetEntity: Periode::class)]
    #[ORM\JoinColumn(name: 'periode_id', referencedColumnName: 'id', nullable: false)]
    private Periode $periode;

    #[ORM\Column(name: 'format', type: Types::STRING, length: 8, enumType: FormatImport::class)]
    private FormatImport $format;

    /** @var array<string, mixed> */
    #[ORM\Column(name: 'parametres', type: Types::JSON, options: ['jsonb' => true])]
    private array $parametres = [];

    #[ORM\Column(name: 'fichier_nom', type: Types::STRING, length: 255, nullable: true)]
    private ?string $fichierNom = null;

    #[ORM\Column(name: 'fichier_sha256', type: Types::STRING, length: 64, nullable: true)]
    private ?string $fichierSha256 = null;

    #[ORM\Column(name: 'nb_lignes', type: Types::INTEGER, options: ['default' => 0])]
    private int $nbLignes = 0;

    #[ORM\Column(name: 'montant_total', type: Types::DECIMAL, precision: 20, scale: 2, options: ['default' => '0.00'])]
    private string $montantTotal = '0.00';

    #[ORM\Column(name: 'statut', type: Types::STRING, length: 16, enumType: StatutLotImport::class)]
    private StatutLotImport $statut = StatutLotImport::ACTIF;

    #[ORM\ManyToOne(targetEntity: Utilisateur::class)]
    #[ORM\JoinColumn(name: 'importe_par_id', referencedColumnName: 'id', nullable: true)]
    private ?Utilisateur $importePar = null;

    #[ORM\Column(name: 'importe_le', type: Types::DATETIME_IMMUTABLE)]
    private \DateTimeImmutable $importeLe;

    /** @var Collection<int, AnomalieImport> */
    #[ORM\OneToMany(targetEntity: AnomalieImport::class, mappedBy: 'lot', cascade: ['persist', 'remove'], orphanRemoval: true)]
    private Collection $anomalies;

    /**
     * @param array<string, mixed> $parametres
     */
    public function __construct(
        Periode $periode,
        FormatImport $format,
        array $parametres = [],
        ?\DateTimeImmutable $importeLe = null,
    ) {
        $this->periode = $periode;
        $this->format = $format;
        $this->parametres = $parametres;
        $this->importeLe = $importeLe ?? new \DateTimeImmutable();
        $this->anomalies = new ArrayCollection();
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getPeriode(): Periode
    {
        return $this->periode;
    }

    public function getFormat(): FormatImport
    {
        return $this->format;
    }

    /**
     * @return array<string, mixed>
     */
    public function getParametres(): array
    {
        return $this->parametres;
    }

    /**
     * @param array<string, mixed> $parametres
     */
    public function setParametres(array $parametres): static
    {
        $this->parametres = $parametres;

        return $this;
    }

    public function getFichierNom(): ?string
    {
        return $this->fichierNom;
    }

    public function setFichierNom(?string $fichierNom): static
    {
        $this->fichierNom = $fichierNom;

        return $this;
    }

    public function getFichierSha256(): ?string
    {
        return $this->fichierSha256;
    }

    public function setFichierSha256(?string $fichierSha256): static
    {
        $this->fichierSha256 = $fichierSha256;

        return $this;
    }

    public function getNbLignes(): int
    {
        return $this->nbLignes;
    }

    public function setNbLignes(int $nbLignes): static
    {
        $this->nbLignes = $nbLignes;

        return $this;
    }

    public function getMontantTotal(): string
    {
        return $this->montantTotal;
    }

    public function setMontantTotal(string $montantTotal): static
    {
        $this->montantTotal = $montantTotal;

        return $this;
    }

    public function getStatut(): StatutLotImport
    {
        return $this->statut;
    }

    public function setStatut(StatutLotImport $statut): static
    {
        $this->statut = $statut;

        return $this;
    }

    public function getImportePar(): ?Utilisateur
    {
        return $this->importePar;
    }

    public function setImportePar(?Utilisateur $importePar): static
    {
        $this->importePar = $importePar;

        return $this;
    }

    public function getImporteLe(): \DateTimeImmutable
    {
        return $this->importeLe;
    }

    public function setImporteLe(\DateTimeImmutable $importeLe): static
    {
        $this->importeLe = $importeLe;

        return $this;
    }

    /**
     * @return Collection<int, AnomalieImport>
     */
    public function getAnomalies(): Collection
    {
        return $this->anomalies;
    }

    public function ajouterAnomalie(AnomalieImport $anomalie): static
    {
        if (!$this->anomalies->contains($anomalie)) {
            $this->anomalies->add($anomalie);
            $anomalie->setLot($this);
        }

        return $this;
    }

    /** Référence affichée (maquette LOT-…). */
    public function reference(): string
    {
        $mois = str_pad((string) $this->periode->getMois(), 2, '0', STR_PAD_LEFT);

        return sprintf('LOT-%s-%s-%d', $this->format->value, $mois, $this->id ?? 0);
    }
}
