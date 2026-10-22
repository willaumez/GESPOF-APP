<?php

declare(strict_types=1);

namespace App\Module\ServicePrevision\Entite\FicheBleu;

use App\Module\ServicePrevision\Enum\TypeSection;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;

/**
 * Bibliothèque hiérarchique des sections et sous-sections connues (ex.
 * SOLDES BANCAIRES D'OUVERTURE > SOLDE BEAC / SOLDE BGFI), gérée dans les
 * paramètres du portail SP. Sert de réservoir de libellés à la composition
 * d'une FicheBleue : les Section d'une fiche sont créées par copie du
 * libellé et du type, sans lien persistant avec la bibliothèque.
 *
 * type : SOLDE (en-tête / soldes bancaires), RECETTE ou DEPENSE. La
 * bibliothèque peut contenir plusieurs sections SOLDE ; une Fiche Bleue
 * n'en admettra qu'une (contrainte à la composition).
 */
#[ORM\Entity]
#[ORM\Table(name: 'bibliotheque_section')]
#[ORM\Index(columns: ['type'], name: 'IDX_BB5DEEDC8CDE5729')]
class BibliothequeSection
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column(type: Types::INTEGER)]
    private ?int $id = null;

    #[ORM\Column(name: 'libelle', length: 255)]
    private string $libelle;

    #[ORM\Column(name: 'type', length: 20, enumType: TypeSection::class)]
    private TypeSection $type;

    /** Position parmi les sections de même niveau (déplacement haut / bas). */
    #[ORM\Column(name: 'ordre', type: Types::INTEGER)]
    private int $ordre = 0;

    #[ORM\Column(name: 'date_creation', type: Types::DATETIME_IMMUTABLE)]
    private \DateTimeImmutable $dateCreation;

    /** Nom complet de l'agent SP qui a ajouté la section à la bibliothèque. */
    #[ORM\Column(name: 'createur', length: 255)]
    private string $createur;

    #[ORM\ManyToOne(targetEntity: self::class, inversedBy: 'sousSections')]
    #[ORM\JoinColumn(name: 'section_parente_id', referencedColumnName: 'id', nullable: true)]
    private ?BibliothequeSection $sectionParente = null;

    /**
     * @var Collection<int, BibliothequeSection>
     */
    #[ORM\OneToMany(targetEntity: self::class, mappedBy: 'sectionParente', cascade: ['persist', 'remove'], orphanRemoval: true)]
    #[ORM\OrderBy(['ordre' => 'ASC'])]
    private Collection $sousSections;

    public function __construct(string $libelle, string $createur, TypeSection $type = TypeSection::RECETTE)
    {
        $this->libelle = $libelle;
        $this->createur = $createur;
        $this->type = $type;
        $this->dateCreation = new \DateTimeImmutable();
        $this->sousSections = new ArrayCollection();
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getLibelle(): string
    {
        return $this->libelle;
    }

    public function setLibelle(string $libelle): static
    {
        $this->libelle = $libelle;

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
     * descendance (une sous-section partage toujours le type de sa racine).
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

    public function getDateCreation(): \DateTimeImmutable
    {
        return $this->dateCreation;
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

    public function getSectionParente(): ?BibliothequeSection
    {
        return $this->sectionParente;
    }

    public function setSectionParente(?BibliothequeSection $sectionParente): static
    {
        $this->sectionParente = $sectionParente;

        return $this;
    }

    public function estSousSection(): bool
    {
        return $this->sectionParente !== null;
    }

    /**
     * @return Collection<int, BibliothequeSection>
     */
    public function getSousSections(): Collection
    {
        return $this->sousSections;
    }

    public function ajouterSousSection(BibliothequeSection $sousSection): static
    {
        if (!$this->sousSections->contains($sousSection)) {
            $this->sousSections->add($sousSection);
            $sousSection->setSectionParente($this);
        }

        return $this;
    }

    public function supprimerSousSection(BibliothequeSection $sousSection): static
    {
        if ($this->sousSections->removeElement($sousSection)) {
            if ($sousSection->getSectionParente() === $this) {
                $sousSection->setSectionParente(null);
            }
        }

        return $this;
    }

    /**
     * Vraie si `$section` appartient à la descendance de cette section
     * (contrôle anti-cycle avant un déplacement).
     */
    public function estAncetreDe(BibliothequeSection $section): bool
    {
        $parent = $section->getSectionParente();
        while ($parent !== null) {
            if ($parent === $this) {
                return true;
            }
            $parent = $parent->getSectionParente();
        }

        return false;
    }
}
