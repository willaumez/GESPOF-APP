<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Entite\Recette;

use App\Module\ServiceOperationsFinancieres\Entite\Exercice;
use App\Module\ServiceOperationsFinancieres\Enum\TypeRecette;
use Doctrine\ORM\Mapping as ORM;

/**
 * Recette pétrolière : montant d'une société pour une catégorie à une date.
 * Unicité (société, catégorie, date) portée par la classe mère Recette.
 */
#[ORM\Entity]
class RecettePetroliere extends Recette
{
    // Colonnes nullables en base (table partagée avec les autres types), jamais null côté PHP.
    #[ORM\ManyToOne(targetEntity: SocietePetroliere::class)]
    #[ORM\JoinColumn(name: 'societe_matricule', referencedColumnName: 'matricule', nullable: true)]
    private SocietePetroliere $societe;

    #[ORM\ManyToOne(targetEntity: CategoriePetroliere::class)]
    #[ORM\JoinColumn(name: 'categorie_id', referencedColumnName: 'id', nullable: true)]
    private CategoriePetroliere $categorie;

    public function __construct(
        Exercice $exercice,
        SocietePetroliere $societe,
        CategoriePetroliere $categorie,
        \DateTimeImmutable $dateRecette,
        string $montantAutomatise = '0.00',
        string $montantAjustement = '0.00',
    ) {
        parent::__construct($exercice, $dateRecette, $montantAutomatise, $montantAjustement);
        $this->societe = $societe;
        $this->categorie = $categorie;
    }

    public function getType(): TypeRecette
    {
        return TypeRecette::PETROLIERE;
    }

    public function getSociete(): SocietePetroliere
    {
        return $this->societe;
    }

    public function getCategorie(): CategoriePetroliere
    {
        return $this->categorie;
    }
}
