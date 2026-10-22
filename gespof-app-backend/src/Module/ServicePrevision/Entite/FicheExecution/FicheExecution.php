<?php

declare(strict_types=1);

namespace App\Module\ServicePrevision\Entite\FicheExecution;

use App\Module\ServicePrevision\Entite\CompositionSectionsTrait;
use App\Module\ServicePrevision\Entite\FicheBleu\Section;
use App\Module\ServicePrevision\Entite\JourneeTresorerie\JourneeTresorerie;
use App\Module\ServicePrevision\Enum\StatutFiche;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;

/**
 * Fiche d'exécution : document de suivi de réalisation qui partage le même
 * modèle de Section / LigneSection que la Fiche Bleue (prévision).
 *
 * reference : FE-JJ-MM-AAAA-NNN (ex. FE-20-08-2026-001), voir genererReference().
 *
 * Composition : exactement une section racine SOLDE (en-tête obligatoire),
 * plus des sections RECETTE / DEPENSE. Champs propres : totaux de soldes
 * bancaires d'entrée et de clôture.
 */
#[ORM\Entity]
#[ORM\Table(name: 'fiche_execution')]
class FicheExecution
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

    /** Dernière mise à jour de la fiche, null tant qu'elle n'a pas été retouchée. */
    #[ORM\Column(name: 'date_dernier_mise_jour', type: Types::DATETIME_IMMUTABLE, nullable: true)]
    private ?\DateTimeImmutable $dateDernierMiseJour = null;

    #[ORM\Column(name: 'montant_total_programme', type: Types::DECIMAL, precision: 15, scale: 2)]
    private string $montantTotalProgramme = '0.00';

    #[ORM\Column(name: 'montant_total_realisation', type: Types::DECIMAL, precision: 15, scale: 2)]
    private string $montantTotalRealisation = '0.00';

    /** Écart global = montantTotalRealisation - montantTotalProgramme. */
    #[ORM\Column(name: 'ecart_total', type: Types::DECIMAL, precision: 15, scale: 2)]
    private string $ecartTotal = '0.00';

    /** Total de la section Solde bancaire d'entrée (en-tête). */
    #[ORM\Column(name: 'total_solde_bancaire_entree', type: Types::DECIMAL, precision: 15, scale: 2)]
    private string $totalSoldeBancaireEntree = '0.00';

    /** Solde bancaire de clôture calculé / saisi en fin de fiche. */
    #[ORM\Column(name: 'solde_bancaire_cloture', type: Types::DECIMAL, precision: 15, scale: 2)]
    private string $soldeBancaireCloture = '0.00';

    #[ORM\Column(name: 'statut', length: 20, enumType: StatutFiche::class)]
    // EN_COURS à la création. Plus tard : CLOTURE à la clôture de la
    // JournéeTresorerie.
    private StatutFiche $statut = StatutFiche::EN_COURS;

    /** Nom complet de l'agent SP qui a créé la fiche. */
    #[ORM\Column(name: 'createur', length: 255)]
    private string $createur;

    /**
     * Toutes les Section de la fiche (racines ET sous-sections).
     *
     * @var Collection<int, Section>
     */
    #[ORM\OneToMany(targetEntity: Section::class, mappedBy: 'ficheExecution', cascade: ['persist', 'remove'], orphanRemoval: true)]
    #[ORM\OrderBy(['ordre' => 'ASC'])]
    private Collection $sections;

    /** Journée de trésorerie à laquelle cette fiche est rattachée (null tant qu'elle n'y est pas liée). */
    #[ORM\OneToOne(targetEntity: JourneeTresorerie::class, mappedBy: 'ficheExecution')]
    private ?JourneeTresorerie $journeeTresorerie = null;

    public function __construct(string $reference, string $createur)
    {
        $this->reference = $reference;
        $this->createur = $createur;
        $this->dateCreation = new \DateTimeImmutable();
        $this->sections = new ArrayCollection();
    }

    /**
     * Construit une référence au format FE-JJ-MM-AAAA-NNN,
     * ex. genererReference(2026-08-20, 1) => "FE-20-08-2026-001".
     */
    public static function genererReference(\DateTimeInterface $date, int $increment): string
    {
        return sprintf('FE-%s-%03d', $date->format('d-m-Y'), $increment);
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

    public function getDateDernierMiseJour(): ?\DateTimeImmutable
    {
        return $this->dateDernierMiseJour;
    }

    public function setDateDernierMiseJour(?\DateTimeImmutable $dateDernierMiseJour): static
    {
        $this->dateDernierMiseJour = $dateDernierMiseJour;

        return $this;
    }

    /** À appeler à chaque modification de la fiche. */
    public function toucher(): static
    {
        $this->dateDernierMiseJour = new \DateTimeImmutable();

        return $this;
    }

    public function getMontantTotalProgramme(): string
    {
        return $this->montantTotalProgramme;
    }

    public function getMontantTotalRealisation(): string
    {
        return $this->montantTotalRealisation;
    }

    public function getEcartTotal(): string
    {
        return $this->ecartTotal;
    }

    public function getTotalSoldeBancaireEntree(): string
    {
        return $this->totalSoldeBancaireEntree;
    }

    public function setTotalSoldeBancaireEntree(string $totalSoldeBancaireEntree): static
    {
        $this->totalSoldeBancaireEntree = $totalSoldeBancaireEntree;

        return $this;
    }

    public function getSoldeBancaireCloture(): string
    {
        return $this->soldeBancaireCloture;
    }

    public function setSoldeBancaireCloture(string $soldeBancaireCloture): static
    {
        $this->soldeBancaireCloture = $soldeBancaireCloture;

        return $this;
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
        $section->setFicheExecution($this);
        $section->setFicheBleue(null);
    }

    protected function detacherSection(Section $section): void
    {
        if ($section->getFicheExecution() === $this) {
            $section->setFicheExecution(null);
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
     * Recalcule le montant réalisé (réalisation) de chaque Section racine
     * puis fixe montantTotalRealisation à leur somme.
     */
    public function calculerMontantTotalRealisation(): string
    {
        $total = '0';
        foreach ($this->getSectionsRacines() as $section) {
            $total = bcadd($total, $section->calculerMontantRealise(), 2);
        }

        $this->montantTotalRealisation = $total;

        return $this->montantTotalRealisation;
    }

    /**
     * Recalcule l'écart de chaque Section, fixe ecartTotal
     * (= programme - réalisé, ou 0 si réalisé total à 0), et synchronise
     * totalSoldeBancaireEntree avec le montant de la section Solde racine.
     */
    public function calculerEcart(): string
    {
        foreach ($this->getSectionsRacines() as $section) {
            $section->calculerEcart();
        }

        $programme = $this->calculerMontantTotalProgramme();
        $realise = $this->calculerMontantTotalRealisation();

        if (bccomp($realise, '0', 2) === 0) {
            $this->ecartTotal = '0.00';
        } else {
            $this->ecartTotal = bcsub($programme, $realise, 2);
        }

        $solde = $this->getSectionSoldeRacine();
        if ($solde !== null) {
            // Préfère le réalisé s'il est renseigné, sinon le programmé.
            $montantSolde = $solde->getMontantRealise();
            if (bccomp($montantSolde, '0', 2) === 0) {
                $montantSolde = $solde->getMontantProgramme();
            }
            $this->totalSoldeBancaireEntree = $montantSolde;
        }

        return $this->ecartTotal;
    }
}
