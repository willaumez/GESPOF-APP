<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Service;

use App\Module\ServiceOperationsFinancieres\Entite\Exercice;
use App\Module\ServiceOperationsFinancieres\Entite\Referentiel\RubriqueDepense;
use App\Module\ServiceOperationsFinancieres\Entite\Recette\RubriqueRecette;
use App\Module\ServiceOperationsFinancieres\Repository\ExerciceRepository;
use App\Module\ServiceOperationsFinancieres\Repository\RubriqueDepenseRepository;
use App\Module\ServiceOperationsFinancieres\Repository\RubriqueRecetteRepository;

/**
 * Consultation du référentiel budgétaire SOF (nomenclature + exercices).
 */
class ReferentielBudgetaireService
{
    public function __construct(
        private readonly RubriqueRecetteRepository $rubriqueRecetteRepository,
        private readonly RubriqueDepenseRepository $rubriqueDepenseRepository,
        private readonly ExerciceRepository $exerciceRepository,
    ) {
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function arbreRubriquesRecettes(): array
    {
        return array_map(
            fn (RubriqueRecette $r): array => $this->serialiserRubriqueRecette($r),
            $this->rubriqueRecetteRepository->findRacines(),
        );
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function arbreRubriquesDepenses(): array
    {
        return array_map(
            fn (RubriqueDepense $r): array => $this->serialiserRubriqueDepense($r),
            $this->rubriqueDepenseRepository->findRacines(),
        );
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function listerExercices(): array
    {
        return array_map(
            fn (Exercice $e): array => [
                'annee' => $e->getAnnee(),
                'loi_finances_en_vigueur' => $e->getLoiFinancesEnVigueur(),
                'solde_ouverture' => $e->getSoldeOuverture(),
            ],
            $this->exerciceRepository->listerParAnneeDesc(),
        );
    }

    /**
     * @return array<string, mixed>
     */
    private function serialiserRubriqueRecette(RubriqueRecette $rubrique): array
    {
        return [
            'code' => $rubrique->getCode(),
            'libelle' => $rubrique->getLibelle(),
            'niveau' => $rubrique->getNiveau(),
            'section' => $rubrique->getSection()->value,
            'section_libelle' => $rubrique->getSection()->libelle(),
            'code_synthetique' => $rubrique->isCodeSynthetique(),
            'est_racine' => $rubrique->estRacine(),
            'enfants' => array_map(
                fn (RubriqueRecette $enfant): array => $this->serialiserRubriqueRecette($enfant),
                $rubrique->getEnfants()->toArray(),
            ),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function serialiserRubriqueDepense(RubriqueDepense $rubrique): array
    {
        return [
            'code' => $rubrique->getCode(),
            'libelle' => $rubrique->getLibelle(),
            'niveau' => $rubrique->getNiveau(),
            'nature' => $rubrique->getNature()->value,
            'nature_libelle' => $rubrique->getNature()->libelle(),
            'code_synthetique' => $rubrique->isCodeSynthetique(),
            'est_racine' => $rubrique->estRacine(),
            'enfants' => array_map(
                fn (RubriqueDepense $enfant): array => $this->serialiserRubriqueDepense($enfant),
                $rubrique->getEnfants()->toArray(),
            ),
        ];
    }
}
