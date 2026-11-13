<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Entite\Referentiel;

use App\Module\ServiceOperationsFinancieres\Enum\TypeLoiFinances;
use App\Module\ServiceOperationsFinancieres\Repository\LoiFinancesRepository;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity(repositoryClass: LoiFinancesRepository::class)]
#[ORM\Table(name: 'sof_loi_finances')]
#[ORM\UniqueConstraint(name: 'uniq_sof_loi_finances_ex_type', columns: ['exercice_annee', 'type'])]
class LoiFinances
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column(name: 'id', type: Types::INTEGER)]
    private ?int $id = null;

    #[ORM\Column(name: 'exercice_annee', type: Types::INTEGER)]
    private int $exerciceAnnee;

    #[ORM\Column(name: 'type', type: Types::STRING, length: 8, enumType: TypeLoiFinances::class)]
    private TypeLoiFinances $type;

    #[ORM\Column(name: 'libelle', type: Types::STRING, length: 64)]
    private string $libelle;

    #[ORM\Column(name: 'date_loi', type: Types::DATE_IMMUTABLE, nullable: true)]
    private ?\DateTimeImmutable $dateLoi = null;

    /** @var Collection<int, LfRecette> */
    #[ORM\OneToMany(targetEntity: LfRecette::class, mappedBy: 'loi', cascade: ['persist', 'remove'], orphanRemoval: true)]
    private Collection $recettes;

    /** @var Collection<int, LfDepense> */
    #[ORM\OneToMany(targetEntity: LfDepense::class, mappedBy: 'loi', cascade: ['persist', 'remove'], orphanRemoval: true)]
    private Collection $depenses;

    /** @var Collection<int, LfFinancement> */
    #[ORM\OneToMany(targetEntity: LfFinancement::class, mappedBy: 'loi', cascade: ['persist', 'remove'], orphanRemoval: true)]
    #[ORM\OrderBy(['ordre' => 'ASC', 'id' => 'ASC'])]
    private Collection $financements;

    /** @var Collection<int, LfTauxAffectation> */
    #[ORM\OneToMany(targetEntity: LfTauxAffectation::class, mappedBy: 'loi', cascade: ['persist', 'remove'], orphanRemoval: true)]
    private Collection $tauxAffectations;

    public function __construct(int $exerciceAnnee, TypeLoiFinances $type, ?string $libelle = null)
    {
        $this->exerciceAnnee = $exerciceAnnee;
        $this->type = $type;
        $this->libelle = $libelle ?? $type->libelle($exerciceAnnee);
        $this->recettes = new ArrayCollection();
        $this->depenses = new ArrayCollection();
        $this->financements = new ArrayCollection();
        $this->tauxAffectations = new ArrayCollection();
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getExerciceAnnee(): int
    {
        return $this->exerciceAnnee;
    }

    public function getType(): TypeLoiFinances
    {
        return $this->type;
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

    public function getDateLoi(): ?\DateTimeImmutable
    {
        return $this->dateLoi;
    }

    public function setDateLoi(?\DateTimeImmutable $dateLoi): static
    {
        $this->dateLoi = $dateLoi;

        return $this;
    }

    /** @return Collection<int, LfRecette> */
    public function getRecettes(): Collection
    {
        return $this->recettes;
    }

    /** @return Collection<int, LfDepense> */
    public function getDepenses(): Collection
    {
        return $this->depenses;
    }

    /** @return Collection<int, LfFinancement> */
    public function getFinancements(): Collection
    {
        return $this->financements;
    }

    /** @return Collection<int, LfTauxAffectation> */
    public function getTauxAffectations(): Collection
    {
        return $this->tauxAffectations;
    }

    public function ajouterRecette(LfRecette $r): static
    {
        if (!$this->recettes->contains($r)) {
            $this->recettes->add($r);
            $r->setLoi($this);
        }

        return $this;
    }

    public function ajouterDepense(LfDepense $d): static
    {
        if (!$this->depenses->contains($d)) {
            $this->depenses->add($d);
            $d->setLoi($this);
        }

        return $this;
    }

    public function ajouterFinancement(LfFinancement $f): static
    {
        if (!$this->financements->contains($f)) {
            $this->financements->add($f);
            $f->setLoi($this);
        }

        return $this;
    }

    public function ajouterTauxAffectation(LfTauxAffectation $t): static
    {
        if (!$this->tauxAffectations->contains($t)) {
            $this->tauxAffectations->add($t);
            $t->setLoi($this);
        }

        return $this;
    }

    public function viderLignes(): void
    {
        $this->recettes->clear();
        $this->depenses->clear();
        $this->financements->clear();
        $this->tauxAffectations->clear();
    }
}
