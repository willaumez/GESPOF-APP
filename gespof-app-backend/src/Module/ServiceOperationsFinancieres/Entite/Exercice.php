<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Entite;

use App\Module\ServiceOperationsFinancieres\Entite\Recette\Recette;
use App\Module\ServiceOperationsFinancieres\Repository\ExerciceRepository;
use App\Module\ServiceOperationsFinancieres\Support\Montant;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;

/**
 * Exercice budgétaire SOF.
 * Clé primaire = année (clé métier).
 *
 * loiFinancesEnVigueur est un texte de référence provisoire : l'entité
 * LoiFinances n'est pas créée dans ce ticket.
 */
#[ORM\Entity(repositoryClass: ExerciceRepository::class)]
#[ORM\Table(name: 'sof_exercice')]
class Exercice
{
    #[ORM\Id]
    #[ORM\Column(name: 'annee', type: Types::INTEGER)]
    private int $annee;

    #[ORM\Column(name: 'loi_finances_en_vigueur', type: Types::STRING, length: 255, nullable: true)]
    private ?string $loiFinancesEnVigueur = null;

    #[ORM\Column(name: 'solde_ouverture', type: Types::DECIMAL, precision: 15, scale: 2)]
    private string $soldeOuverture;

    /**
     * @var Collection<int, Recette>
     */
    #[ORM\OneToMany(targetEntity: Recette::class, mappedBy: 'exercice')]
    private Collection $recettes;

    /**
     * @var Collection<int, Depense>
     */
    #[ORM\OneToMany(targetEntity: Depense::class, mappedBy: 'exercice')]
    private Collection $depenses;

    public function __construct(int $annee, string $soldeOuverture = '0.00', ?string $loiFinancesEnVigueur = null)
    {
        $this->annee = $annee;
        $this->soldeOuverture = Montant::normaliser($soldeOuverture);
        $this->loiFinancesEnVigueur = $loiFinancesEnVigueur;
        $this->recettes = new ArrayCollection();
        $this->depenses = new ArrayCollection();
    }

    public function getAnnee(): int
    {
        return $this->annee;
    }

    public function getLoiFinancesEnVigueur(): ?string
    {
        return $this->loiFinancesEnVigueur;
    }

    public function setLoiFinancesEnVigueur(?string $loiFinancesEnVigueur): static
    {
        $this->loiFinancesEnVigueur = $loiFinancesEnVigueur;

        return $this;
    }

    public function getSoldeOuverture(): string
    {
        return $this->soldeOuverture;
    }

    public function setSoldeOuverture(string $soldeOuverture): static
    {
        $this->soldeOuverture = Montant::normaliser($soldeOuverture);

        return $this;
    }

    /**
     * @return Collection<int, Recette>
     */
    public function getRecettes(): Collection
    {
        return $this->recettes;
    }

    public function addRecette(Recette $recette): static
    {
        if (!$this->recettes->contains($recette)) {
            $this->recettes->add($recette);
        }

        return $this;
    }

    /**
     * @return Collection<int, Depense>
     */
    public function getDepenses(): Collection
    {
        return $this->depenses;
    }

    public function addDepense(Depense $depense): static
    {
        if (!$this->depenses->contains($depense)) {
            $this->depenses->add($depense);
        }

        return $this;
    }
}
