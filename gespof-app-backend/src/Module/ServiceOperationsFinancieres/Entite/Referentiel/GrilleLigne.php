<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Entite\Referentiel;

use App\Module\ServiceOperationsFinancieres\Repository\GrilleLigneRepository;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity(repositoryClass: GrilleLigneRepository::class)]
#[ORM\Table(name: 'sof_grille_ligne')]
class GrilleLigne
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column(name: 'id', type: Types::INTEGER)]
    private ?int $id = null;

    #[ORM\ManyToOne(targetEntity: Grille::class, inversedBy: 'lignes')]
    #[ORM\JoinColumn(name: 'grille_id', referencedColumnName: 'id', nullable: false, onDelete: 'CASCADE')]
    private ?Grille $grille = null;

    #[ORM\Column(name: 'code', type: Types::STRING, length: 64, nullable: true)]
    private ?string $code = null;

    #[ORM\Column(name: 'libelle', type: Types::STRING, length: 255)]
    private string $libelle;

    #[ORM\Column(name: 'ordre', type: Types::INTEGER)]
    private int $ordre = 0;

    #[ORM\Column(name: 'rubrique_code', type: Types::STRING, length: 32, nullable: true)]
    private ?string $rubriqueCode = null;

    #[ORM\Column(name: 'niveau', type: Types::SMALLINT)]
    private int $niveau = 0;

    #[ORM\Column(name: 'calculable', type: Types::BOOLEAN)]
    private bool $calculable = false;

    /**
     * @var Collection<int, GrilleValeur>
     */
    #[ORM\OneToMany(targetEntity: GrilleValeur::class, mappedBy: 'ligne', cascade: ['persist', 'remove'], orphanRemoval: true)]
    #[ORM\OrderBy(['mois' => 'ASC'])]
    private Collection $valeurs;

    public function __construct(string $libelle, int $ordre = 0, ?string $code = null)
    {
        $this->libelle = $libelle;
        $this->ordre = $ordre;
        $this->code = $code;
        $this->valeurs = new ArrayCollection();
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getGrille(): ?Grille
    {
        return $this->grille;
    }

    public function setGrille(?Grille $grille): static
    {
        $this->grille = $grille;

        return $this;
    }

    public function getCode(): ?string
    {
        return $this->code;
    }

    public function setCode(?string $code): static
    {
        $this->code = $code;

        return $this;
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

    public function getOrdre(): int
    {
        return $this->ordre;
    }

    public function setOrdre(int $ordre): static
    {
        $this->ordre = $ordre;

        return $this;
    }

    public function getRubriqueCode(): ?string
    {
        return $this->rubriqueCode;
    }

    public function setRubriqueCode(?string $rubriqueCode): static
    {
        $this->rubriqueCode = $rubriqueCode;

        return $this;
    }

    public function getNiveau(): int
    {
        return $this->niveau;
    }

    public function setNiveau(int $niveau): static
    {
        $this->niveau = $niveau;

        return $this;
    }

    public function isCalculable(): bool
    {
        return $this->calculable;
    }

    public function setCalculable(bool $calculable): static
    {
        $this->calculable = $calculable;

        return $this;
    }

    /**
     * @return Collection<int, GrilleValeur>
     */
    public function getValeurs(): Collection
    {
        return $this->valeurs;
    }

    public function ajouterValeur(GrilleValeur $valeur): static
    {
        if (!$this->valeurs->contains($valeur)) {
            $this->valeurs->add($valeur);
            $valeur->setLigne($this);
        }

        return $this;
    }

    public function trouverValeurMois(int $mois): ?GrilleValeur
    {
        foreach ($this->valeurs as $v) {
            if ($v->getMois() === $mois) {
                return $v;
            }
        }

        return null;
    }
}
