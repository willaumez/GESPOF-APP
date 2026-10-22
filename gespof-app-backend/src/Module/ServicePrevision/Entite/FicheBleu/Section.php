<?php

declare(strict_types=1);

namespace App\Module\ServicePrevision\Entite\FicheBleu;

use App\Module\ServicePrevision\Entite\FicheExecution\FicheExecution;
use App\Module\ServicePrevision\Enum\TypeSection;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;

/**
 * Section (ou sous-section) d'une FicheBleue ou d'une FicheExecution : porte
 * des LigneSection et, éventuellement, des sous-Section. Ses montants
 * programmé / réalisé sont la somme de ses lignes actives (hors lignes de
 * total) et de ses sous-sections.
 *
 * Exactement un propriétaire : ficheBleue XOR ficheExecution.
 * type : SOLDE (en-tête unique et obligatoire au niveau racine), RECETTE ou DEPENSE.
 */
#[ORM\Entity]
#[ORM\Table(name: 'section')]
class Section
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column(type: Types::INTEGER)]
    private ?int $id = null;

    #[ORM\Column(name: 'nom', length: 255)]
    private string $nom;

    #[ORM\Column(name: 'type', length: 20, enumType: TypeSection::class)]
    private TypeSection $type;

    #[ORM\Column(name: 'ordre', type: Types::INTEGER)]
    private int $ordre = 0;

    #[ORM\Column(name: 'montant_programme', type: Types::DECIMAL, precision: 15, scale: 2)]
    private string $montantProgramme = '0.00';

    #[ORM\Column(name: 'montant_realise', type: Types::DECIMAL, precision: 15, scale: 2)]
    private string $montantRealise = '0.00';

    /** Écart = montantRealise - montantProgramme. */
    #[ORM\Column(name: 'montant_ecart', type: Types::DECIMAL, precision: 15, scale: 2)]
    private string $montantEcart = '0.00';

    #[ORM\Column(name: 'est_affichee', type: Types::BOOLEAN)]
    private bool $estAffichee = true;

    /** false : la section est figée, l'agent ne peut pas la sélectionner / retirer. */
    #[ORM\Column(name: 'est_selectionnable', type: Types::BOOLEAN)]
    private bool $estSelectionnable = true;

    /**
     * true : rubrique ajoutée en Fiche d'exécution, hors programmation
     * de la Fiche Bleue (étiquette « Non programmé »).
     */
    #[ORM\Column(name: 'non_programme', type: Types::BOOLEAN)]
    private bool $nonProgramme = false;

    #[ORM\ManyToOne(targetEntity: FicheBleue::class, inversedBy: 'sections')]
    #[ORM\JoinColumn(name: 'fiche_bleue_id', referencedColumnName: 'id', nullable: true)]
    private ?FicheBleue $ficheBleue = null;

    #[ORM\ManyToOne(targetEntity: FicheExecution::class, inversedBy: 'sections')]
    #[ORM\JoinColumn(name: 'fiche_execution_id', referencedColumnName: 'id', nullable: true)]
    private ?FicheExecution $ficheExecution = null;

    #[ORM\ManyToOne(targetEntity: self::class, inversedBy: 'sousSections')]
    #[ORM\JoinColumn(name: 'section_parente_id', referencedColumnName: 'id', nullable: true)]
    private ?Section $sectionParente = null;

    /**
     * @var Collection<int, Section>
     */
    #[ORM\OneToMany(targetEntity: self::class, mappedBy: 'sectionParente', cascade: ['persist', 'remove'], orphanRemoval: true)]
    #[ORM\OrderBy(['ordre' => 'ASC'])]
    private Collection $sousSections;

    /**
     * @var Collection<int, LigneSection>
     */
    #[ORM\OneToMany(targetEntity: LigneSection::class, mappedBy: 'section', cascade: ['persist', 'remove'], orphanRemoval: true)]
    #[ORM\OrderBy(['ordre' => 'ASC'])]
    private Collection $lignes;

    public function __construct(string $nom, TypeSection $type = TypeSection::RECETTE)
    {
        $this->nom = $nom;
        $this->type = $type;
        $this->sousSections = new ArrayCollection();
        $this->lignes = new ArrayCollection();
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getNom(): string
    {
        return $this->nom;
    }

    public function setNom(string $nom): static
    {
        $this->nom = $nom;

        return $this;
    }

    public function getType(): TypeSection
    {
        return $this->type;
    }

    public function setType(TypeSection $type): static
    {
        $this->type = $type;

        return $this;
    }

    /**
     * Applique `$type` à cette section et, récursivement, à toute sa
     * descendance (une sous-section partage le type de sa racine).
     */
    public function appliquerTypeEnCascade(TypeSection $type): static
    {
        $this->type = $type;
        foreach ($this->sousSections as $sousSection) {
            $sousSection->appliquerTypeEnCascade($type);
        }

        return $this;
    }

    public function getOrdre(): int
    {
        return $this->ordre;
    }

    public function setOrdre(int $ordre): static
    {
        $this->ordre = $ordre;

        return $this;
    }

    public function getMontantProgramme(): string
    {
        return $this->montantProgramme;
    }

    public function setMontantProgramme(string $montantProgramme): static
    {
        $this->montantProgramme = $montantProgramme;

        return $this;
    }

    public function getMontantRealise(): string
    {
        return $this->montantRealise;
    }

    public function setMontantRealise(string $montantRealise): static
    {
        $this->montantRealise = $montantRealise;

        return $this;
    }

    public function getMontantEcart(): string
    {
        return $this->montantEcart;
    }

    public function estAffichee(): bool
    {
        return $this->estAffichee;
    }

    public function setEstAffichee(bool $estAffichee): static
    {
        $this->estAffichee = $estAffichee;

        return $this;
    }

    public function estSelectionnable(): bool
    {
        return $this->estSelectionnable;
    }

    public function setEstSelectionnable(bool $estSelectionnable): static
    {
        $this->estSelectionnable = $estSelectionnable;

        return $this;
    }

    public function estNonProgramme(): bool
    {
        return $this->nonProgramme;
    }

    public function setNonProgramme(bool $nonProgramme): static
    {
        $this->nonProgramme = $nonProgramme;

        return $this;
    }

    public function getFicheBleue(): ?FicheBleue
    {
        return $this->ficheBleue;
    }

    public function setFicheBleue(?FicheBleue $ficheBleue): static
    {
        $this->ficheBleue = $ficheBleue;

        return $this;
    }

    public function getFicheExecution(): ?FicheExecution
    {
        return $this->ficheExecution;
    }

    public function setFicheExecution(?FicheExecution $ficheExecution): static
    {
        $this->ficheExecution = $ficheExecution;

        return $this;
    }

    public function getSectionParente(): ?Section
    {
        return $this->sectionParente;
    }

    public function setSectionParente(?Section $sectionParente): static
    {
        $this->sectionParente = $sectionParente;

        return $this;
    }

    public function estSousSection(): bool
    {
        return $this->sectionParente !== null;
    }

    /**
     * @return Collection<int, LigneSection>
     */
    public function getLignes(): Collection
    {
        return $this->lignes;
    }

    public function ajouterLigne(LigneSection $ligne): static
    {
        if (!$this->lignes->contains($ligne)) {
            $this->lignes->add($ligne);
            $ligne->setSection($this);
        }

        return $this;
    }

    public function supprimerLigne(LigneSection $ligne): static
    {
        if ($this->lignes->removeElement($ligne)) {
            if ($ligne->getSection() === $this) {
                $ligne->setSection(null);
            }
        }

        return $this;
    }

    /**
     * @return Collection<int, Section>
     */
    public function getSousSections(): Collection
    {
        return $this->sousSections;
    }

    public function ajouterSousSection(Section $sousSection): static
    {
        if (!$this->sousSections->contains($sousSection)) {
            $this->sousSections->add($sousSection);
            $sousSection->setSectionParente($this);
            $sousSection->setType($this->type);
            $sousSection->setFicheBleue($this->ficheBleue);
            $sousSection->setFicheExecution($this->ficheExecution);
        }

        return $this;
    }

    public function supprimerSousSection(Section $sousSection): static
    {
        if ($this->sousSections->removeElement($sousSection)) {
            if ($sousSection->getSectionParente() === $this) {
                $sousSection->setSectionParente(null);
            }
        }

        return $this;
    }

    /**
     * Recalcule montantProgramme :
     * - s'il y a des sous-sections : somme de leurs montants (cascade) + lignes ;
     * - feuille sans lignes : conserve le montant saisi sur la section ;
     * - feuille avec lignes : somme des lignes actives (hors total).
     */
    public function calculerMontantProgramme(): string
    {
        $totalLignes = '0';
        $aLignes = false;
        foreach ($this->lignes as $ligne) {
            if ($ligne->estActif() && !$ligne->estTotal()) {
                $aLignes = true;
                $totalLignes = bcadd($totalLignes, $ligne->getMontantProgramme(), 2);
            }
        }

        if (!$this->sousSections->isEmpty()) {
            $total = $totalLignes;
            foreach ($this->sousSections as $sousSection) {
                $total = bcadd($total, $sousSection->calculerMontantProgramme(), 2);
            }
            $this->montantProgramme = $total;

            return $this->montantProgramme;
        }

        // Feuille : lignes si présentes, sinon montant saisi sur la section.
        if ($aLignes) {
            $this->montantProgramme = $totalLignes;
        }

        return $this->montantProgramme;
    }

    /**
     * Même règle que calculerMontantProgramme(), appliquée aux montants réalisés.
     */
    public function calculerMontantRealise(): string
    {
        $totalLignes = '0';
        $aLignes = false;
        foreach ($this->lignes as $ligne) {
            if ($ligne->estActif() && !$ligne->estTotal()) {
                $aLignes = true;
                $totalLignes = bcadd($totalLignes, $ligne->getMontantRealise(), 2);
            }
        }

        if (!$this->sousSections->isEmpty()) {
            $total = $totalLignes;
            foreach ($this->sousSections as $sousSection) {
                $total = bcadd($total, $sousSection->calculerMontantRealise(), 2);
            }
            $this->montantRealise = $total;

            return $this->montantRealise;
        }

        if ($aLignes) {
            $this->montantRealise = $totalLignes;
        }

        return $this->montantRealise;
    }

    /**
     * Recalcule l'écart de chaque ligne et de chaque sous-section, puis fixe
     * montantEcart = montantProgramme - montantRealise.
     * Si le réalisé est à 0, l'écart n'est pas calculé (reste 0.00).
     */
    public function calculerEcart(): string
    {
        foreach ($this->lignes as $ligne) {
            $ligne->calculerEcart();
        }
        foreach ($this->sousSections as $sousSection) {
            $sousSection->calculerEcart();
        }

        $programme = $this->calculerMontantProgramme();
        $realise = $this->calculerMontantRealise();

        if (bccomp($realise, '0', 2) === 0) {
            $this->montantEcart = '0.00';
        } else {
            $this->montantEcart = bcsub($programme, $realise, 2);
        }

        return $this->montantEcart;
    }

    /**
     * Renumérote les lignes de 1 à n en respectant leur ordre actuel
     * (utile après une suppression ou un déplacement).
     */
    public function reordonnerLignes(): static
    {
        $lignes = $this->lignes->toArray();
        usort($lignes, static fn (LigneSection $a, LigneSection $b): int => $a->getOrdre() <=> $b->getOrdre());

        foreach ($lignes as $index => $ligne) {
            $ligne->setOrdre($index + 1);
        }

        return $this;
    }

    /**
     * Copie profonde de la section : lignes et sous-sections incluses, sans
     * identifiant ni rattachement à une fiche.
     */
    public function copier(): self
    {
        $copie = new self($this->nom, $this->type);
        $copie->ordre = $this->ordre;
        $copie->montantProgramme = $this->montantProgramme;
        $copie->montantRealise = $this->montantRealise;
        $copie->montantEcart = $this->montantEcart;
        $copie->estAffichee = $this->estAffichee;
        $copie->estSelectionnable = $this->estSelectionnable;
        $copie->nonProgramme = $this->nonProgramme;

        foreach ($this->lignes as $ligne) {
            $copie->ajouterLigne($ligne->copier());
        }
        foreach ($this->sousSections as $sousSection) {
            $copie->ajouterSousSection($sousSection->copier());
        }

        return $copie;
    }
}
