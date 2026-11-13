<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Controller;

use App\Module\ServiceOperationsFinancieres\Service\AppuisAvancesEmpruntsService;
use App\Shared\Controller\DomainExceptionResponseTrait;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

#[Route('/api/v1/sof/recettes/appuis-emprunts')]
#[IsGranted('ROLE_AGENT_SOF')]
final class AppuisAvancesEmpruntsController extends AbstractController
{
    use DomainExceptionResponseTrait;

    public function __construct(
        private readonly AppuisAvancesEmpruntsService $appuisAvancesEmpruntsService,
    ) {
    }

    #[Route('', name: 'sof_recettes_appuis_emprunts', methods: ['GET'])]
    public function index(Request $request): JsonResponse
    {
        $periode = $request->query->get('periode_id');
        $periodeId = $periode !== null && $periode !== '' ? (int) $periode : null;

        return $this->run(fn () => new JsonResponse(
            $this->appuisAvancesEmpruntsService->obtenir($periodeId),
        ));
    }

    #[Route('/recalculer', name: 'sof_recettes_appuis_emprunts_recalculer', methods: ['POST'])]
    #[IsGranted('ROLE_CHEF_SOF')]
    public function recalculer(Request $request): JsonResponse
    {
        return $this->run(function () use ($request) {
            $payload = json_decode($request->getContent(), true);
            $payload = \is_array($payload) ? $payload : [];
            $periode = $payload['periode_id'] ?? $request->query->get('periode_id');

            return new JsonResponse(
                $this->appuisAvancesEmpruntsService->recalculer(
                    is_numeric($periode) ? (int) $periode : null,
                ),
            );
        });
    }
}
