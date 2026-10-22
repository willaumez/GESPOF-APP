<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\DataFixtures;

use App\Module\ServiceOperationsFinancieres\Entite\Referentiel\RubriqueDepense;
use App\Module\ServiceOperationsFinancieres\Enum\NatureDepense;
use Doctrine\Persistence\ObjectManager;

/**
 * Nomenclature hiérarchique des rubriques de dépenses SOF.
 *
 * Les fixtures d'origine (App\DataFixtures\Sof) n'étaient pas présentes dans
 * le dépôt : ce chargeur reprend la même intention (arbre auto-référencé,
 * codes métier, codes synthétiques pour les regroupements).
 */
final class RubriqueDepenseFixtures
{
    public function charger(ObjectManager $manager): void
    {
        $exc = $this->rubrique($manager, 'EXC', "Dépenses de l'exercice", NatureDepense::EXERCICE_COURANT, null, true);
        $this->rubrique($manager, 'PERS', 'Personnel', NatureDepense::EXERCICE_COURANT, $exc);
        $this->rubrique($manager, 'BNS', 'Biens et services', NatureDepense::EXERCICE_COURANT, $exc);
        $this->rubrique($manager, 'TRANS', 'Transferts', NatureDepense::EXERCICE_COURANT, $exc);
        $this->rubrique($manager, 'INV', 'Investissements', NatureDepense::EXERCICE_COURANT, $exc);
        $this->rubrique($manager, 'DETTE', 'Service de la dette', NatureDepense::EXERCICE_COURANT, $exc);

        $exa = $this->rubrique($manager, 'EXA', 'Dépenses sur exercices antérieurs', NatureDepense::EX_ANTERIEUR, null, true);
        $this->rubrique($manager, 'ARR', 'Arriérés de dépenses', NatureDepense::EX_ANTERIEUR, $exa);
        $this->rubrique($manager, 'RAP', 'Restes à payer', NatureDepense::EX_ANTERIEUR, $exa);

        $so = $this->rubrique($manager, 'SO', 'Dépenses sans ordonnancement', NatureDepense::SANS_ORDONNANCEMENT, null, true);
        $this->rubrique($manager, 'SO_TVA', 'Remboursements TVA', NatureDepense::SANS_ORDONNANCEMENT, $so);
        $this->rubrique($manager, 'SO_AUT', 'Autres dépenses sans ordonnancement', NatureDepense::SANS_ORDONNANCEMENT, $so);
    }

    private function rubrique(
        ObjectManager $manager,
        string $code,
        string $libelle,
        NatureDepense $nature,
        ?RubriqueDepense $parent,
        bool $codeSynthetique = false,
    ): RubriqueDepense {
        $existant = $manager->find(RubriqueDepense::class, $code);
        if ($existant instanceof RubriqueDepense) {
            return $existant;
        }

        $rubrique = new RubriqueDepense($code, $libelle, $nature, $parent, $codeSynthetique);
        $manager->persist($rubrique);

        return $rubrique;
    }
}
