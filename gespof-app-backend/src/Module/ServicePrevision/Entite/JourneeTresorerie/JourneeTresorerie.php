<?php

declare(strict_types=1);

namespace App\Module\ServicePrevision\Entite\JourneeTresorerie;

use App\Module\ServicePrevision\Entite\FicheBleu\FicheBleue;
use App\Module\ServicePrevision\Entite\FicheExecution\FicheExecution;
use App\Module\ServicePrevision\Enum\EtatJournee;
use App\Module\ServicePrevision\Enum\TypeSection;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;

/**
 * Journée de trésorerie : regroupe éventuellement une Fiche Bleue (prévision)
 * et une Fiche d'exécution (réalisation) pour une même journée.
 *
 * Clé primaire = reference : JT-JJ-MM-AAAA-NNN (ex. JT-20-08-2026-001).
 *
 * À la création : référence, dates, état BROUILLON — les fiches peuvent être
 * rattachées plus tard. Les totaux sont recalculés depuis la Fiche d'exécution
 * lorsqu'elle est présente (synchroniserDepuisFicheExecution()).
 */
#[ORM\Entity]
#[ORM\Table(name: 'journee_tresorerie')]
class JourneeTresorerie
{
    #[ORM\Id]
    #[ORM\Column(name: 'reference', length: 30)]
    private string $reference;

    #[ORM\Column(name: 'date_creation', type: Types::DATETIME_IMMUTABLE)]
    private \DateTimeImmutable $dateCreation;

    /** Dernière mise à jour, null tant que la journée n'a pas été retouchée. */
    #[ORM\Column(name: 'date_derniere_mise_a_jour', type: Types::DATETIME_IMMUTABLE, nullable: true)]
    private ?\DateTimeImmutable $dateDerniereMiseAJour = null;

    #[ORM\Column(name: 'solde_ouverture', type: Types::DECIMAL, precision: 15, scale: 2)]
    private string $soldeOuverture = '0.00';

    #[ORM\Column(name: 'total_recettes', type: Types::DECIMAL, precision: 15, scale: 2)]
    private string $totalRecettes = '0.00';

    #[ORM\Column(name: 'total_depenses', type: Types::DECIMAL, precision: 15, scale: 2)]
    private string $totalDepenses = '0.00';

    #[ORM\Column(name: 'solde_cloture', type: Types::DECIMAL, precision: 15, scale: 2)]
    private string $soldeCloture = '0.00';

    #[ORM\Column(name: 'etat', length: 20, enumType: EtatJournee::class)]
    private EtatJournee $etat = EtatJournee::BROUILLON;

    #[ORM\OneToOne(targetEntity: FicheBleue::class, inversedBy: 'journeeTresorerie')]
    #[ORM\JoinColumn(name: 'fiche_bleue_id', referencedColumnName: 'id', nullable: true, unique: true)]
    private ?FicheBleue $ficheBleue = null;

    #[ORM\OneToOne(targetEntity: FicheExecution::class, inversedBy: 'journeeTresorerie')]
    #[ORM\JoinColumn(name: 'fiche_execution_id', referencedColumnName: 'id', nullable: true, unique: true)]
    private ?FicheExecution $ficheExecution = null;

    /**
     * Snapshot Oracle (date d'ouverture + recettes/dépenses) pour cette journée.
     *
     * @var array<string, mixed>|null
     */
    #[ORM\Column(name: 'operations_jour', type: Types::JSON, nullable: true)]
    private ?array $operationsJour = null;

    /**
     * Liste des recettes Oracle validée pour cette journée (date d'ouverture,
     * auteur, total, recettes). Sert de base au rapprochement avec la Fiche d'exécution.
     *
     * @var array<string, mixed>|null
     */
    #[ORM\Column(name: 'recettes_jour', type: Types::JSON, nullable: true)]
    private ?array $recettesJour = null;

    /**
     * Liste des dépenses validée : union dédoublonnée des fiches de dépôt
     * reçues pour la journée (une fiche peut reprendre la précédente).
     *
     * @var array<string, mixed>|null
     */
    #[ORM\Column(name: 'depenses_jour', type: Types::JSON, nullable: true)]
    private ?array $depensesJour = null;

    public function __construct(string $reference)
    {
        $this->reference = $reference;
        $this->dateCreation = new \DateTimeImmutable();
        $this->etat = EtatJournee::BROUILLON;
    }

    /**
     * Construit une référence au format JT-JJ-MM-AAAA-NNN,
     * ex. genererReference(2026-08-20, 1) => "JT-20-08-2026-001".
     */
    public static function genererReference(\DateTimeInterface $date, int $increment): string
    {
        return sprintf('JT-%s-%03d', $date->format('d-m-Y'), $increment);
    }

    public function getReference(): string
    {
        return $this->reference;
    }

    public function getDateCreation(): \DateTimeImmutable
    {
        return $this->dateCreation;
    }

    public function getDateDerniereMiseAJour(): ?\DateTimeImmutable
    {
        return $this->dateDerniereMiseAJour;
    }

    public function setDateDerniereMiseAJour(?\DateTimeImmutable $dateDerniereMiseAJour): static
    {
        $this->dateDerniereMiseAJour = $dateDerniereMiseAJour;

        return $this;
    }

    /** À appeler à chaque modification de la journée. */
    public function toucher(): static
    {
        $this->dateDerniereMiseAJour = new \DateTimeImmutable();

        return $this;
    }

    public function getSoldeOuverture(): string
    {
        return $this->soldeOuverture;
    }

    public function getTotalRecettes(): string
    {
        return $this->totalRecettes;
    }

    public function getTotalDepenses(): string
    {
        return $this->totalDepenses;
    }

    public function getSoldeCloture(): string
    {
        return $this->soldeCloture;
    }

    public function getEtat(): EtatJournee
    {
        return $this->etat;
    }

    public function setEtat(EtatJournee $etat): static
    {
        $this->etat = $etat;

        return $this;
    }

    public function getFicheBleue(): ?FicheBleue
    {
        return $this->ficheBleue;
    }

    public function setFicheBleue(?FicheBleue $ficheBleue): static
    {
        $this->ficheBleue = $ficheBleue;
        $ficheBleue?->setJourneeTresorerie($this);

        return $this;
    }

    public function getFicheExecution(): ?FicheExecution
    {
        return $this->ficheExecution;
    }

    public function setFicheExecution(?FicheExecution $ficheExecution): static
    {
        $this->ficheExecution = $ficheExecution;
        $ficheExecution?->setJourneeTresorerie($this);

        return $this;
    }

    /**
     * Snapshot date d'ouverture + opérations Oracle, ou null si jamais enregistré.
     *
     * @return array<string, mixed>|null
     */
    public function getOperationsJour(): ?array
    {
        return $this->operationsJour;
    }

    /**
     * @param array<string, mixed>|null $operationsJour
     */
    public function setOperationsJour(?array $operationsJour): static
    {
        $this->operationsJour = $operationsJour;

        return $this;
    }

    /**
     * Liste des recettes validée, ou null si aucune liste n'a été validée.
     *
     * @return array<string, mixed>|null
     */
    public function getRecettesJour(): ?array
    {
        return $this->recettesJour;
    }

    /**
     * @param array<string, mixed>|null $recettesJour
     */
    public function setRecettesJour(?array $recettesJour): static
    {
        $this->recettesJour = $recettesJour;

        return $this;
    }

    /**
     * Liste des dépenses validée, ou null si aucune liste n'a été validée.
     *
     * @return array<string, mixed>|null
     */
    public function getDepensesJour(): ?array
    {
        return $this->depensesJour;
    }

    /**
     * @param array<string, mixed>|null $depensesJour
     */
    public function setDepensesJour(?array $depensesJour): static
    {
        $this->depensesJour = $depensesJour;

        return $this;
    }

    /**
     * Recalcule soldeOuverture, totalRecettes, totalDepenses et soldeCloture
     * à partir de la Fiche d'exécution liée (no-op si absente).
     */
    public function synchroniserDepuisFicheExecution(): static
    {
        $fiche = $this->ficheExecution;
        if ($fiche === null) {
            return $this;
        }

        $this->soldeOuverture = $fiche->getTotalSoldeBancaireEntree();
        $this->soldeCloture = $fiche->getSoldeBancaireCloture();

        $totalRecettes = '0';
        $totalDepenses = '0';
        foreach ($fiche->getSections() as $section) {
            if ($section->estSousSection()) {
                continue;
            }
            if ($section->getType() === TypeSection::RECETTE) {
                $totalRecettes = bcadd($totalRecettes, $section->getMontantRealise(), 2);
            }
            if ($section->getType() === TypeSection::DEPENSE) {
                $totalDepenses = bcadd($totalDepenses, $section->getMontantRealise(), 2);
            }
        }

        $this->totalRecettes = $totalRecettes;
        $this->totalDepenses = $totalDepenses;

        return $this;
    }

    /** Journée clôturée (et non réouverte) : plus aucune modification n'est permise. */
    public function estCloturee(): bool
    {
        return $this->etat === EtatJournee::CLOTURE;
    }

    /**
     * Clôture la journée. Si le solde de clôture n'est pas renseigné,
     * il est estimé : ouverture + recettes − dépenses.
     */
    public function cloturer(): static
    {
        if ($this->etat === EtatJournee::CLOTURE) {
            return $this;
        }
        if (bccomp($this->soldeCloture, '0', 2) === 0) {
            $this->soldeCloture = bcsub(
                bcadd($this->soldeOuverture, $this->totalRecettes, 2),
                $this->totalDepenses,
                2,
            );
        }
        $this->etat = EtatJournee::CLOTURE;
        $this->toucher();

        return $this;
    }

    /**
     * Annule la clôture : la journée repasse EN_COURS et ses montants sont
     * recalculés depuis la Fiche d'exécution (abandon du solde estimé à la clôture).
     */
    public function reouvrir(): static
    {
        if ($this->etat !== EtatJournee::CLOTURE) {
            return $this;
        }
        $this->etat = EtatJournee::EN_COURS;
        $this->synchroniserDepuisFicheExecution();
        $this->toucher();

        return $this;
    }
}
