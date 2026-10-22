<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\DataFixtures;

use App\Module\ServiceOperationsFinancieres\Entite\Recette\RubriqueRecette;
use App\Module\ServiceOperationsFinancieres\Enum\SectionRecette;
use Doctrine\Persistence\ObjectManager;

/**
 * Nomenclature hiérarchique des rubriques de recettes SOF.
 *
 * Les fixtures d'origine (App\DataFixtures\Sof) n'étaient pas présentes dans
 * le dépôt : ce chargeur reprend la même intention (arbre auto-référencé,
 * codes métier, codes synthétiques pour les regroupements).
 */
final class RubriqueRecetteFixtures
{
    public function charger(ObjectManager $manager): void
    {
        $pet = $this->rubrique($manager, 'PET', 'Recettes pétrolières', SectionRecette::PETROLE, null, true);
        $this->rubrique($manager, '103', 'Profit oil', SectionRecette::PETROLE, $pet);
        $this->rubrique($manager, '104', 'Redevances pétrolières', SectionRecette::PETROLE, $pet);
        $this->rubrique($manager, '105', 'Impôt sur les sociétés pétrolières', SectionRecette::PETROLE, $pet);

        $fis = $this->rubrique($manager, 'FIS', 'Recettes fiscales', SectionRecette::RECETTES_FISCALES, null, true);
        $tva = $this->rubrique($manager, 'TVA', 'Taxe sur la valeur ajoutée', SectionRecette::RECETTES_FISCALES, $fis, true);
        $this->rubrique($manager, 'TVA_GRP', 'TVA Groupe', SectionRecette::RECETTES_FISCALES, $tva);
        $this->rubrique($manager, 'TVA_INT', 'TVA intérieure', SectionRecette::RECETTES_FISCALES, $tva);
        $this->rubrique($manager, 'TVA_IMP', "TVA à l'importation", SectionRecette::RECETTES_FISCALES, $tva);
        $this->rubrique($manager, 'IS', 'Impôt sur les sociétés', SectionRecette::RECETTES_FISCALES, $fis);
        $this->rubrique($manager, 'IRPP', 'Impôt sur le revenu des personnes physiques', SectionRecette::RECETTES_FISCALES, $fis);
        $this->rubrique($manager, 'AAH', 'Autres impôts et taxes', SectionRecette::RECETTES_FISCALES, $fis);
        $this->rubrique($manager, 'DDI', "Droits de douane à l'importation", SectionRecette::RECETTES_FISCALES, $fis);

        $nfi = $this->rubrique($manager, 'NFI', 'Recettes non fiscales', SectionRecette::RECETTES_NON_FISCALES, null, true);
        $this->rubrique($manager, 'DIV', 'Dividendes', SectionRecette::RECETTES_NON_FISCALES, $nfi);
        $this->rubrique($manager, 'RED', 'Redevances diverses', SectionRecette::RECETTES_NON_FISCALES, $nfi);
        $this->rubrique($manager, 'AMENDE', 'Amendes et condamnations pécuniaires', SectionRecette::RECETTES_NON_FISCALES, $nfi);

        $aff = $this->rubrique($manager, 'AFF', 'Recettes affectées', SectionRecette::RECETTES_AFFECTEES, null, true);
        $this->rubrique($manager, 'AFF_TVA', 'Affectation TVA', SectionRecette::RECETTES_AFFECTEES, $aff);
        $this->rubrique($manager, 'AFF_PET', 'Affectation pétrole', SectionRecette::RECETTES_AFFECTEES, $aff);

        $emp = $this->rubrique($manager, 'EMP', 'Emprunts', SectionRecette::EMPRUNT, null, true);
        $this->rubrique($manager, 'EMP_INT', 'Emprunts intérieurs', SectionRecette::EMPRUNT, $emp);
        $this->rubrique($manager, 'EMP_EXT', 'Emprunts extérieurs', SectionRecette::EMPRUNT, $emp);

        $nbd = $this->rubrique($manager, 'NBD', 'Recettes non budgétaires', SectionRecette::NON_BUDGETAIRE, null, true);
        $this->rubrique($manager, 'COR', 'Correspondants du Trésor', SectionRecette::NON_BUDGETAIRE, $nbd);
        $this->rubrique($manager, 'DEP_ATT', 'Dépôts et consignations', SectionRecette::NON_BUDGETAIRE, $nbd);
    }

    private function rubrique(
        ObjectManager $manager,
        string $code,
        string $libelle,
        SectionRecette $section,
        ?RubriqueRecette $parent,
        bool $codeSynthetique = false,
    ): RubriqueRecette {
        $existant = $manager->find(RubriqueRecette::class, $code);
        if ($existant instanceof RubriqueRecette) {
            return $existant;
        }

        $rubrique = new RubriqueRecette($code, $libelle, $section, $parent, $codeSynthetique);
        $manager->persist($rubrique);

        return $rubrique;
    }
}
