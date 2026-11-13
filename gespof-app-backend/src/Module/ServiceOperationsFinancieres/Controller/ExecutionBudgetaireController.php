<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Controller;

use App\Module\ServiceOperationsFinancieres\Service\ExecutionDepensesService;
use App\Module\ServiceOperationsFinancieres\Service\ExecutionRapService;
use App\Shared\Controller\DomainExceptionResponseTrait;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

#[Route('/api/v1/sof/execution')]
#[IsGranted('ROLE_AGENT_SOF')]
final class ExecutionBudgetaireController extends AbstractController
{
    use DomainExceptionResponseTrait;

    public function __construct(
        private readonly ExecutionRapService $executionRapService,
        private readonly ExecutionDepensesService $executionDepensesService,
    ) {
    }

    #[Route('/rap', name: 'sof_execution_rap', methods: ['GET'])]
    public function rap(Request $request): JsonResponse
    {
        return $this->run(fn () => new JsonResponse(
            $this->executionRapService->situation(
                $this->periodeId($request),
                $request->query->get('vue'),
            ),
        ));
    }

    #[Route('/rap/synthese', name: 'sof_execution_rap_synthese', methods: ['GET'])]
    public function rapSynthese(Request $request): JsonResponse
    {
        return $this->run(function () use ($request) {
            $sit = $this->executionRapService->situation($this->periodeId($request));

            return new JsonResponse([
                'periode' => $sit['periode'],
                'synthese' => $sit['synthese'],
                'kpis' => $sit['kpis'],
            ]);
        });
    }

    #[Route('/depenses/titres', name: 'sof_execution_titres', methods: ['GET'])]
    public function titres(Request $request): JsonResponse
    {
        return $this->run(fn () => new JsonResponse(
            $this->executionDepensesService->parTitres($this->periodeId($request)),
        ));
    }

    #[Route('/depenses/titres-natures', name: 'sof_execution_titres_natures', methods: ['GET'])]
    public function titresNatures(Request $request): JsonResponse
    {
        return $this->run(fn () => new JsonResponse(
            $this->executionDepensesService->parTitresNatures($this->periodeId($request)),
        ));
    }

    #[Route('/depenses/missions', name: 'sof_execution_missions', methods: ['GET'])]
    public function missions(Request $request): JsonResponse
    {
        return $this->run(fn () => new JsonResponse(
            $this->executionDepensesService->parMissions($this->periodeId($request)),
        ));
    }

    #[Route('/depenses/hors-ordonnances', name: 'sof_execution_hors_ordos', methods: ['GET'])]
    public function horsOrdos(Request $request): JsonResponse
    {
        return $this->run(fn () => new JsonResponse(
            $this->executionDepensesService->horsOrdonnances($this->periodeId($request)),
        ));
    }

    #[Route('/resume', name: 'sof_execution_resume', methods: ['GET'])]
    public function resume(Request $request): JsonResponse
    {
        return $this->run(fn () => new JsonResponse(
            $this->executionDepensesService->resume($this->periodeId($request)),
        ));
    }

    private function periodeId(Request $request): ?int
    {
        $periode = $request->query->get('periode_id');

        return $periode !== null && $periode !== '' ? (int) $periode : null;
    }
}
