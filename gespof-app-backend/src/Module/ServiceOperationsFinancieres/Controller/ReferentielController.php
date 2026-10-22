<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Controller;

use App\Module\ServiceOperationsFinancieres\Service\ReferentielBudgetaireService;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

#[Route('/api/v1/sof/referentiel')]
#[IsGranted('ROLE_AGENT_SOF')]
final class ReferentielController extends AbstractController
{
    public function __construct(
        private readonly ReferentielBudgetaireService $referentiel,
    ) {
    }

    #[Route('/rubriques-recettes', name: 'sof_referentiel_rubriques_recettes', methods: ['GET'])]
    public function rubriquesRecettes(): JsonResponse
    {
        return new JsonResponse(['rubriques' => $this->referentiel->arbreRubriquesRecettes()]);
    }

    #[Route('/rubriques-depenses', name: 'sof_referentiel_rubriques_depenses', methods: ['GET'])]
    public function rubriquesDepenses(): JsonResponse
    {
        return new JsonResponse(['rubriques' => $this->referentiel->arbreRubriquesDepenses()]);
    }

    #[Route('/exercices', name: 'sof_referentiel_exercices', methods: ['GET'])]
    public function exercices(): JsonResponse
    {
        return new JsonResponse(['exercices' => $this->referentiel->listerExercices()]);
    }
}
