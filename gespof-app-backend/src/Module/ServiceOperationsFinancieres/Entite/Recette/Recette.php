<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Entite\Recette;

use App\Module\ServiceOperationsFinancieres\Entite\Exercice;
use App\Module\ServiceOperationsFinancieres\Enum\TypeRecette;
use App\Module\ServiceOperationsFinancieres\Repository\RecetteRepository;
use App\Module\ServiceOperationsFinancieres\Support\Montant;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;

/**
 * Montant réalisé d'une recette à une date donnée d'un exercice.
 *
 * Classe mère abstraite (héritage SINGLE_TABLE sur sof_recette) : chaque
 * type de recette porte sa propre catégorie (CategoriePetroliere pour le
 * pétrole, CompteDouane pour la douane). Les index et contraintes d'unicité
 * sont déclarés ici, car Doctrine ne les prend en compte que sur l'entité racine.
 *
 * Une contrainte d'unicité par type est indispensable : les colonnes des
 * autres types sont NULL et PostgreSQL considère les NULL comme distincts.
 */
#[ORM\Entity(repositoryClass: RecetteRepository::class)]
#[ORM\Table(name: 'sof_recette')]
#[ORM\InheritanceType('SINGLE_TABLE')]
#[ORM\DiscriminatorColumn(name: 'type_recette', type: Types::STRING, length: 20)]
#[ORM\DiscriminatorMap([
    'PETROLIERE' => RecettePetroliere::class,
    'DOUANIERE' => RecetteDouaniere::class,
    // 'FISCALE' => RecetteFiscale::class,
])]
#[ORM\Index(name: 'IDX_SOF_RECETTE_EXERCICE_MOIS', columns: ['exercice_annee', 'mois'])]
#[ORM\Index(name: 'IDX_SOF_RECETTE_CAT_SOC', columns: ['categorie_id', 'societe_id'])]
#[ORM\Index(name: 'IDX_SOF_RECETTE_COMPTE_DOUANE', columns: ['compte_douane'])]
#[ORM\UniqueConstraint(name: 'UNIQ_SOF_RECETTE_PETROLIERE', columns: ['societe_id', 'categorie_id', 'date_recette'])]
#[ORM\UniqueConstraint(name: 'UNIQ_SOF_RECETTE_DOUANIERE', columns: ['compte_douane', 'date_recette'])]
abstract class Recette
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column(type: Types::INTEGER)]
    private ?int $id = null;

    #[ORM\ManyToOne(targetEntity: Exercice::class, inversedBy: 'recettes')]
    #[ORM\JoinColumn(name: 'exercice_annee', referencedColumnName: 'annee', nullable: false)]
    private Exercice $exercice;

    #[ORM\Column(name: 'date_recette', type: Types::DATE_IMMUTABLE)]
    private \DateTimeImmutable $dateRecette;

    /** CALCULÉ : déduit de dateRecette (stocké pour l'index et le GROUP BY). */
    #[ORM\Column(name: 'mois', type: Types::SMALLINT)]
    private int $mois;

    /** Alimenté par l'extraction Oracle. */
    #[ORM\Column(name: 'montant_automatise', type: Types::DECIMAL, precision: 15, scale: 2)]
    private string $montantAutomatise = '0.00';

    /** Saisie manuelle (négatif pour une déduction/compensation). */
    #[ORM\Column(name: 'montant_ajustement', type: Types::DECIMAL, precision: 15, scale: 2)]
    private string $montantAjustement = '0.00';

    /** CALCULÉ : automatisé + ajustement, recalculé dans les setters. */
    #[ORM\Column(name: 'montant_total', type: Types::DECIMAL, precision: 15, scale: 2)]
    private string $montantTotal = '0.00';

    protected function __construct(
        Exercice $exercice,
        \DateTimeImmutable $dateRecette,
        string $montantAutomatise = '0.00',
        string $montantAjustement = '0.00',
    ) {
        $this->exercice = $exercice;
        $this->definirDate($dateRecette);
        $this->montantAutomatise = Montant::normaliser($montantAutomatise);
        $this->montantAjustement = Montant::normaliser($montantAjustement);
        $this->recalculerMontantTotal();
        $exercice->addRecette($this);
    }

    abstract public function getType(): TypeRecette;

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getExercice(): Exercice
    {
        return $this->exercice;
    }

    public function getDateRecette(): \DateTimeImmutable
    {
        return $this->dateRecette;
    }

    public function setDateRecette(\DateTimeImmutable $dateRecette): static
    {
        $this->definirDate($dateRecette);

        return $this;
    }

    public function getMois(): int
    {
        return $this->mois;
    }

    public function getMontantAutomatise(): string
    {
        return $this->montantAutomatise;
    }

    public function setMontantAutomatise(string $montantAutomatise): static
    {
        $this->montantAutomatise = Montant::normaliser($montantAutomatise);
        $this->recalculerMontantTotal();

        return $this;
    }

    public function getMontantAjustement(): string
    {
        return $this->montantAjustement;
    }

    public function setMontantAjustement(string $montantAjustement): static
    {
        $this->montantAjustement = Montant::normaliser($montantAjustement);
        $this->recalculerMontantTotal();

        return $this;
    }

    public function getMontantTotal(): string
    {
        return $this->montantTotal;
    }

    private function definirDate(\DateTimeImmutable $date): void
    {
        if ((int) $date->format('Y') !== $this->exercice->getAnnee()) {
            throw new \InvalidArgumentException(sprintf(
                'La date %s ne correspond pas à l\'exercice %d.',
                $date->format('Y-m-d'),
                $this->exercice->getAnnee(),
            ));
        }

        $this->dateRecette = $date;
        $this->mois = (int) $date->format('n');
    }

    /**
     * montantTotal = montantAutomatise + montantAjustement (bcmath, échelle 2).
     * Appelé dans les setters plutôt qu'en PreUpdate : Doctrine ne détecte pas
     * les modifications faites dans un callback PreUpdate.
     */
    private function recalculerMontantTotal(): void
    {
        $this->montantTotal = Montant::additionner($this->montantAutomatise, $this->montantAjustement);
    }
}
