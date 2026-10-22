<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Entite\Recette;

use App\Module\ServiceOperationsFinancieres\Entite\Exercice;
use App\Module\ServiceOperationsFinancieres\Enum\TypeRecette;
use Doctrine\ORM\Mapping as ORM;

/**
 * Recette douanière : montant d'un compte douanier à une date.
 * Unicité (compte, date) portée par la classe mère Recette.
 * Montants stockés en FCFA (pas en millions).
 */
#[ORM\Entity]
class RecetteDouaniere extends Recette
{
    // Nullable en base (table partagée avec les autres types), jamais null côté PHP.
    #[ORM\ManyToOne(targetEntity: CompteDouane::class)]
    #[ORM\JoinColumn(name: 'compte_douane', referencedColumnName: 'compte', nullable: true)]
    private CompteDouane $compteDouane;

    public function __construct(
        Exercice $exercice,
        CompteDouane $compteDouane,
        \DateTimeImmutable $dateRecette,
        string $montantAutomatise = '0.00',
        string $montantAjustement = '0.00',
    ) {
        parent::__construct($exercice, $dateRecette, $montantAutomatise, $montantAjustement);
        $this->compteDouane = $compteDouane;
    }

    public function getType(): TypeRecette
    {
        return TypeRecette::DOUANIERE;
    }

    public function getCompteDouane(): CompteDouane
    {
        return $this->compteDouane;
    }
}
