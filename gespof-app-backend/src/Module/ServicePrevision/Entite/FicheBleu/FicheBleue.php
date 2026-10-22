<?php

declare(strict_types=1);

namespace App\Module\ServicePrevision\Entite\FicheBleu;

use App\Module\ServicePrevision\Entite\CompositionSectionsTrait;
use App\Module\ServicePrevision\Entite\JourneeTresorerie\JourneeTresorerie;
use App\Module\ServicePrevision\Enum\StatutFiche;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;

/**
 * Fiche Bleue ("Situation de trésorerie") : document de prévision composé de
 * Section (et sous-Section), elles-mêmes composées de LigneSection.
 *
 * reference : FB-AAAA-MM-JJ-NNN (ex. FB-2026-08-19-001), voir genererReference().
 *
 * Composition : exactement une section racine de type SOLDE (en-tête
 * obligatoire), plus des sections RECETTE / DEPENSE.
 *
 * L'export et l'import Excel du diagramme (exporterVersExcel / importerDeExcel)
 * sont portés par des services dédiés du module, l'entité ne connaissant pas
 * PhpSpreadsheet.
 */
#[ORM\Entity]
#[ORM\Table(name: 'fiche_bleue')]
class FicheBleue
{
    use CompositionSectionsTrait;

    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column(type: Types::INTEGER)]
    private ?int $id = null;

    #[ORM\Column(name: 'reference', length: 30, unique: true)]
    private string $reference;

    #[ORM\Column(name: 'date_creation', type: Types::DATETIME_IMMUTABLE)]
    private \DateTimeImmutable $dateCreation;

    /** Dernière modification de la fiche, null tant qu'elle n'a pas été retouchée. */
    #[ORM\Column(name: 'date_modification', type: Types::DATETIME_IMMUTABLE, nullable: true)]
    private ?\DateTimeImmutable $dateModification = null;

    #[ORM\Column(name: 'montant_total_programme', type: Types::DECIMAL, precision: 15, scale: 2)]
    private string $montantTotalProgramme = '0.00';

    #[ORM\Column(name: 'montant_total_realise', type: Types::DECIMAL, precision: 15, scale: 2)]
    private string $montantTotalRealise = '0.00';

    /** Écart global = montantTotalRealise - montantTotalProgramme. */
    #[ORM\Column(name: 'montant_total_ecart', type: Types::DECIMAL, precision: 15, scale: 2)]
    private string $montantTotalEcart = '0.00';

    #[ORM\Column(name: 'statut', length: 20, enumType: StatutFiche::class)]
    // BROUILLON à la création. Plus tard : EN_COURS si liée à une
    // JournéeTresorerie, CLOTURE à la clôture de cette journée.
    private StatutFiche $statut = StatutFiche::BROUILLON;

    /** Nom complet de l'agent SP qui a créé la fiche. */
    #[ORM\Column(name: 'createur', length: 255)]
    private string $createur;

    /**
     * Toutes les Section de la fiche (racines ET sous-sections : chaque
     * Section, quelle que soit sa profondeur, référence directement sa fiche).
     *
     * @var Collection<int, Section>
     */
    #[ORM\OneToMany(targetEntity: Section::class, mappedBy: 'ficheBleue', cascade: ['persist', 'remove'], orphanRemoval: true)]
    #[ORM\OrderBy(['ordre' => 'ASC'])]
    private Collection $sections;

    /** Journée de trésorerie à laquelle cette fiche est rattachée (null tant qu'elle n'y est pas liée). */
    #[ORM\OneToOne(targetEntity: JourneeTresorerie::class, mappedBy: 'ficheBleue')]
    private ?JourneeTresorerie $journeeTresorerie = null;

    public function __construct(string $reference, string $createur)
    {
        $this->reference = $reference;
        $this->createur = $createur;
        $this->dateCreation = new \DateTimeImmutable();
        $this->sections = new ArrayCollection();
    }

    /**
     * Construit une référence au format FB-AAAA-MM-JJ-NNN,
     * ex. genererReference(2026-08-19, 1) => "FB-2026-08-19-001".
     */
    public static function genererReference(\DateTimeInterface $date, int $increment): string
    {
        return sprintf('FB-%s-%03d', $date->format('Y-m-d'), $increment);
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getReference(): string
    {
        return $this->reference;
    }

    public function setReference(string $reference): static
    {
        $this->reference = $reference;

        return $this;
    }

    public function getDateCreation(): \DateTimeImmutable
    {
        return $this->dateCreation;
    }

    public function setDateCreation(\DateTimeImmutable $dateCreation): static
    {
        $this->dateCreation = $dateCreation;

        return $this;
    }

    public function getDateModification(): ?\DateTimeImmutable
    {
        return $this->dateModification;
    }

    public function setDateModification(?\DateTimeImmutable $dateModification): static
    {
        $this->dateModification = $dateModification;

        return $this;
    }

    /** À appeler à chaque modification de la fiche. */
    public function toucher(): static
    {
        $this->dateModification = new \DateTimeImmutable();

        return $this;
    }

    public function getMontantTotalProgramme(): string
    {
        return $this->montantTotalProgramme;
    }

    public function getMontantTotalRealise(): string
    {
        return $this->montantTotalRealise;
    }

    public function getMontantTotalEcart(): string
    {
        return $this->montantTotalEcart;
    }

    public function getStatut(): StatutFiche
    {
        return $this->statut;
    }

    public function setStatut(StatutFiche $statut): static
    {
        $this->statut = $statut;

        return $this;
    }

    public function getCreateur(): string
    {
        return $this->createur;
    }

    public function setCreateur(string $createur): static
    {
        $this->createur = $createur;

        return $this;
    }

    public function getJourneeTresorerie(): ?JourneeTresorerie
    {
        return $this->journeeTresorerie;
    }

    public function setJourneeTresorerie(?JourneeTresorerie $journeeTresorerie): static
    {
        $this->journeeTresorerie = $journeeTresorerie;

        return $this;
    }

    /**
     * @return Collection<int, Section>
     */
    public function getSections(): Collection
    {
        return $this->sections;
    }

    protected function rattacherSection(Section $section): void
    {
        $section->setFicheBleue($this);
        $section->setFicheExecution(null);
    }

    protected function detacherSection(Section $section): void
    {
        if ($section->getFicheBleue() === $this) {
            $section->setFicheBleue(null);
        }
    }

    /**
     * Recalcule le montant programmé de chaque Section racine puis fixe
     * montantTotalProgramme à leur somme.
     */
    public function calculerMontantTotalProgramme(): string
    {
        $total = '0';
        foreach ($this->getSectionsRacines() as $section) {
            $total = bcadd($total, $section->calculerMontantProgramme(), 2);
        }

        $this->montantTotalProgramme = $total;

        return $this->montantTotalProgramme;
    }

    /**
     * Recalcule le montant réalisé de chaque Section racine puis fixe
     * montantTotalRealise à leur somme.
     */
    public function calculerMontantTotalRealise(): string
    {
        $total = '0';
        foreach ($this->getSectionsRacines() as $section) {
            $total = bcadd($total, $section->calculerMontantRealise(), 2);
        }

        $this->montantTotalRealise = $total;

        return $this->montantTotalRealise;
    }

    /**
     * Recalcule l'écart de chaque Section (et, par cascade, de leurs lignes),
     * puis fixe montantTotalEcart = montantTotalProgramme - montantTotalRealise.
     * Si le total réalisé est à 0, l'écart total reste 0.00.
     */
    public function calculerEcart(): string
    {
        foreach ($this->getSectionsRacines() as $section) {
            $section->calculerEcart();
        }

        $programme = $this->calculerMontantTotalProgramme();
        $realise = $this->calculerMontantTotalRealise();

        if (bccomp($realise, '0', 2) === 0) {
            $this->montantTotalEcart = '0.00';
        } else {
            $this->montantTotalEcart = bcsub($programme, $realise, 2);
        }

        return $this->montantTotalEcart;
    }
}
