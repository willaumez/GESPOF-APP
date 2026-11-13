<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Controller;

use App\Module\ServiceOperationsFinancieres\Service\FicheDepotsService;
use App\Module\ServiceOperationsFinancieres\Service\SrotSituationService;
use App\Shared\Controller\DomainExceptionResponseTrait;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

#[Route('/api/v1/sof/srot')]
#[IsGranted('ROLE_AGENT_SOF')]
final class SrotController extends AbstractController
{
    use DomainExceptionResponseTrait;

    public function __construct(
        private readonly SrotSituationService $srotSituationService,
        private readonly FicheDepotsService $ficheDepotsService,
    ) {
    }

    #[Route('/situation', name: 'sof_srot_situation', methods: ['GET'])]
    public function situation(Request $request): JsonResponse
    {
        $periodeId = $this->periodeId($request);

        return $this->run(fn () => new JsonResponse(
            $this->srotSituationService->situation($periodeId),
        ));
    }

    #[Route('/soldes', name: 'sof_srot_soldes', methods: ['GET'])]
    public function soldes(Request $request): JsonResponse
    {
        $periodeId = $this->periodeId($request);

        return $this->run(fn () => new JsonResponse(
            $this->srotSituationService->soldes($periodeId),
        ));
    }

    #[Route('/equilibre', name: 'sof_srot_equilibre', methods: ['GET'])]
    public function equilibre(Request $request): JsonResponse
    {
        $periodeId = $this->periodeId($request);

        return $this->run(fn () => new JsonResponse(
            $this->srotSituationService->equilibre($periodeId),
        ));
    }

    #[Route('/depots', name: 'sof_srot_depots_lister', methods: ['GET'])]
    public function depotsLister(Request $request): JsonResponse
    {
        $periode = $request->query->get('periode_id');
        $exercice = $request->query->get('exercice');

        return $this->run(fn () => new JsonResponse(
            $this->ficheDepotsService->lister(
                $periode !== null && $periode !== '' ? (int) $periode : null,
                $exercice !== null && $exercice !== '' ? (int) $exercice : null,
            ),
        ));
    }

    #[Route('/depots', name: 'sof_srot_depots_enregistrer', methods: ['PUT'])]
    #[IsGranted('ROLE_CHEF_SOF')]
    public function depotsEnregistrer(Request $request): JsonResponse
    {
        return $this->run(function () use ($request) {
            $payload = json_decode($request->getContent(), true);
            $payload = \is_array($payload) ? $payload : [];
            $exercice = isset($payload['exercice']) ? (int) $payload['exercice'] : 0;
            $lignes = isset($payload['lignes']) && \is_array($payload['lignes']) ? $payload['lignes'] : [];
            if ($exercice <= 0) {
                $etat = $this->ficheDepotsService->lister(null, null);
                $exercice = (int) $etat['exercice'];
            }

            return new JsonResponse(
                $this->ficheDepotsService->enregistrer($exercice, $lignes),
            );
        });
    }

    private function periodeId(Request $request): ?int
    {
        $periode = $request->query->get('periode_id');

        return $periode !== null && $periode !== '' ? (int) $periode : null;
    }
}
