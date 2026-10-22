<?php

declare(strict_types=1);

namespace App\Module\ServicePrevision\Entite\FicheExecutionConso;

use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;

/**
 * Montant réalisé d'une rubrique feuille pour une journée clôturée.
 */
#[ORM\Entity]
#[ORM\Table(name: 'conso_valeur_jour')]
#[ORM\UniqueConstraint(name: 'UNIQ_CONSO_VALEUR_RUBRIQUE_DATE', columns: ['rubrique_id', 'date_jour'])]
#[ORM\Index(name: 'IDX_CONSO_VALEUR_JOURNEE', columns: ['journee_reference'])]
class ConsoValeurJour
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column(type: Types::INTEGER)]
    private ?int $id = null;

    #[ORM\ManyToOne(targetEntity: ConsoRubrique::class, inversedBy: 'valeurs')]
    #[ORM\JoinColumn(name: 'rubrique_id', referencedColumnName: 'id', nullable: false, onDelete: 'CASCADE')]
    private ConsoRubrique $rubrique;

    #[ORM\Column(name: 'date_jour', type: Types::DATE_IMMUTABLE)]
    private \DateTimeImmutable $dateJour;

    #[ORM\Column(name: 'montant_realise', type: Types::DECIMAL, precision: 15, scale: 2)]
    private string $montantRealise = '0.00';

    #[ORM\Column(name: 'journee_reference', length: 40)]
    private string $journeeReference;

    public function __construct(
        ConsoRubrique $rubrique,
        \DateTimeImmutable $dateJour,
        string $montantRealise,
        string $journeeReference,
    ) {
        $this->rubrique = $rubrique;
        $this->dateJour = $dateJour;
        $this->montantRealise = $montantRealise;
        $this->journeeReference = $journeeReference;
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getRubrique(): ConsoRubrique
    {
        return $this->rubrique;
    }

    public function getDateJour(): \DateTimeImmutable
    {
        return $this->dateJour;
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

    public function getJourneeReference(): string
    {
        return $this->journeeReference;
    }

    public function setJourneeReference(string $journeeReference): static
    {
        $this->journeeReference = $journeeReference;

        return $this;
    }
}
