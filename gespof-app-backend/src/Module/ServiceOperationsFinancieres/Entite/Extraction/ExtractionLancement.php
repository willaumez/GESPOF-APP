<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Entite\Extraction;

use App\Module\ServiceOperationsFinancieres\Entite\Periode;
use App\Module\ServiceOperationsFinancieres\Repository\ExtractionLancementRepository;
use App\Shared\Entite\Utilisateur;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity(repositoryClass: ExtractionLancementRepository::class)]
#[ORM\Table(name: 'sof_extraction_lancement')]
#[ORM\Index(name: 'idx_sof_ext_lanc_periode', columns: ['periode_id'])]
#[ORM\Index(name: 'idx_sof_ext_lanc_statut', columns: ['statut'])]
class ExtractionLancement
{
    public const EN_COURS = 'EN_COURS';
    public const TERMINE = 'TERMINE';
    public const ANNULE = 'ANNULE';

    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column(type: Types::INTEGER)]
    private ?int $id = null;

    #[ORM\ManyToOne(targetEntity: Periode::class)]
    #[ORM\JoinColumn(name: 'periode_id', referencedColumnName: 'id', nullable: false, onDelete: 'CASCADE')]
    private Periode $periode;

    #[ORM\Column(type: Types::INTEGER)]
    private int $exercice;

    #[ORM\Column(name: 'date_situation', type: Types::DATE_IMMUTABLE)]
    private \DateTimeImmutable $dateSituation;

    #[ORM\Column(type: Types::STRING, length: 16)]
    private string $statut = self::EN_COURS;

    #[ORM\Column(type: Types::INTEGER)]
    private int $pourcentage = 0;

    #[ORM\ManyToOne(targetEntity: Utilisateur::class)]
    #[ORM\JoinColumn(name: 'lance_par_id', referencedColumnName: 'id', nullable: true)]
    private ?Utilisateur $lancePar = null;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    private \DateTimeImmutable $debut;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE, nullable: true)]
    private ?\DateTimeImmutable $fin = null;

    /**
     * Surcharges par code preset (ex. date_debut / date_fin ISO).
     *
     * @var array<string, array<string, mixed>>|null
     */
    #[ORM\Column(type: Types::JSON, nullable: true)]
    private ?array $surcharges = null;

    /** @var Collection<int, ExtractionElement> */
    #[ORM\OneToMany(targetEntity: ExtractionElement::class, mappedBy: 'lancement', cascade: ['persist', 'remove'], orphanRemoval: true)]
    #[ORM\OrderBy(['ordre' => 'ASC'])]
    private Collection $elements;

    /**
     * @param array<string, array<string, mixed>>|null $surcharges
     */
    public function __construct(
        Periode $periode,
        int $exercice,
        \DateTimeImmutable $dateSituation,
        ?Utilisateur $lancePar = null,
        ?array $surcharges = null,
    ) {
        $this->periode = $periode;
        $this->exercice = $exercice;
        $this->dateSituation = $dateSituation;
        $this->lancePar = $lancePar;
        $this->surcharges = $surcharges;
        $this->debut = new \DateTimeImmutable();
        $this->elements = new ArrayCollection();
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getPeriode(): Periode
    {
        return $this->periode;
    }

    public function getExercice(): int
    {
        return $this->exercice;
    }

    public function getDateSituation(): \DateTimeImmutable
    {
        return $this->dateSituation;
    }

    /**
     * @return array<string, array<string, mixed>>
     */
    public function getSurcharges(): array
    {
        return $this->surcharges ?? [];
    }

    /**
     * @return array<string, mixed>
     */
    public function getSurcharge(string $code): array
    {
        $s = $this->surcharges[$code] ?? null;

        return is_array($s) ? $s : [];
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

    public function getPourcentage(): int
    {
        return $this->pourcentage;
    }

    public function setPourcentage(int $pourcentage): static
    {
        $this->pourcentage = max(0, min(100, $pourcentage));

        return $this;
    }

    public function getDebut(): \DateTimeImmutable
    {
        return $this->debut;
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

    /** @return Collection<int, ExtractionElement> */
    public function getElements(): Collection
    {
        return $this->elements;
    }

    public function ajouterElement(ExtractionElement $el): static
    {
        if (!$this->elements->contains($el)) {
            $this->elements->add($el);
            $el->setLancement($this);
        }

        return $this;
    }
}
