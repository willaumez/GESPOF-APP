<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Entite;

use App\Module\ServiceOperationsFinancieres\Entite\Referentiel\RubriqueDepense;
use App\Module\ServiceOperationsFinancieres\Repository\DepenseRepository;
use App\Module\ServiceOperationsFinancieres\Support\Montant;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;

/**
 * Montant réalisé d'une rubrique de dépense, pour un mois d'un exercice.
 *
 * Un id technique auto-increment est acceptable en complément de la clé
 * métier composite (exercice, rubrique, mois) : cette dernière est
 * composite, donc moins pratique comme clé primaire Doctrine pour les
 * relations entrantes. La contrainte UNIQUE composite reste obligatoire
 * pour l'intégrité métier.
 */
#[ORM\Entity(repositoryClass: DepenseRepository::class)]
#[ORM\Table(name: 'sof_depense')]
#[ORM\UniqueConstraint(
    name: 'UNIQ_SOF_DEPENSE_EXERCICE_RUBRIQUE_MOIS',
    columns: ['exercice_annee', 'rubrique_code', 'mois'],
)]
class Depense
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column(type: Types::INTEGER)]
    private ?int $id = null;

    #[ORM\ManyToOne(targetEntity: Exercice::class, inversedBy: 'depenses')]
    #[ORM\JoinColumn(name: 'exercice_annee', referencedColumnName: 'annee', nullable: false)]
    private Exercice $exercice;

    #[ORM\ManyToOne(targetEntity: RubriqueDepense::class)]
    #[ORM\JoinColumn(name: 'rubrique_code', referencedColumnName: 'code', nullable: false)]
    private RubriqueDepense $rubrique;

    #[ORM\Column(name: 'mois', type: Types::INTEGER)]
    private int $mois;

    /** Alimenté par l'extraction Oracle (hors périmètre de ce ticket). */
    #[ORM\Column(name: 'montant_automatise', type: Types::DECIMAL, precision: 15, scale: 2)]
    private string $montantAutomatise = '0.00';

    /** Saisie manuelle. */
    #[ORM\Column(name: 'montant_ajustement', type: Types::DECIMAL, precision: 15, scale: 2)]
    private string $montantAjustement = '0.00';

    #[ORM\Column(name: 'montant_total', type: Types::DECIMAL, precision: 15, scale: 2)]
    private string $montantTotal = '0.00';

    public function __construct(
        Exercice $exercice,
        RubriqueDepense $rubrique,
        int $mois,
        string $montantAutomatise = '0.00',
        string $montantAjustement = '0.00',
    ) {
        $this->assertMoisValide($mois);
        $this->exercice = $exercice;
        $this->rubrique = $rubrique;
        $this->mois = $mois;
        $this->montantAutomatise = Montant::normaliser($montantAutomatise);
        $this->montantAjustement = Montant::normaliser($montantAjustement);
        $this->recalculerMontantTotal();
        $exercice->addDepense($this);
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getExercice(): Exercice
    {
        return $this->exercice;
    }

    public function getRubrique(): RubriqueDepense
    {
        return $this->rubrique;
    }

    public function getMois(): int
    {
        return $this->mois;
    }

    public function setMois(int $mois): static
    {
        $this->assertMoisValide($mois);
        $this->mois = $mois;

        return $this;
    }

    public function getMontantAutomatise(): string
    {
        return $this->montantAutomatise;
    }

    public function setMontantAutomatise(string $montantAutomatise): static
    {
        $this->montantAutomatise = Montant::normaliser($montantAutomatise);

        return $this;
    }

    public function getMontantAjustement(): string
    {
        return $this->montantAjustement;
    }

    public function setMontantAjustement(string $montantAjustement): static
    {
        $this->montantAjustement = Montant::normaliser($montantAjustement);

        return $this;
    }

    public function getMontantTotal(): string
    {
        return $this->montantTotal;
    }

    /**
     * Recalcule montantTotal = montantAutomatise + montantAjustement (bcmath, échelle 2).
     * À invoquer explicitement après modification des deux autres montants.
     */
    public function recalculerMontantTotal(): void
    {
        $this->montantTotal = Montant::additionner($this->montantAutomatise, $this->montantAjustement);
    }

    private function assertMoisValide(int $mois): void
    {
        if ($mois < 1 || $mois > 12) {
            throw new \InvalidArgumentException(sprintf('Mois invalide : %d (attendu 1 à 12).', $mois));
        }
    }
}
