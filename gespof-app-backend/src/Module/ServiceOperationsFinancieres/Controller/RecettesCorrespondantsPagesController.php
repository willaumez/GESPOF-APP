<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Controller;

use App\Module\ServiceOperationsFinancieres\Service\CorrespondantsService;
use App\Shared\Controller\DomainExceptionResponseTrait;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

/**
 * Recettes › Correspondants (agrégat lot F10 recettes).
 */
#[Route('/api/v1/sof/recettes/correspondants')]
#[IsGranted('ROLE_AGENT_SOF')]
final class RecettesCorrespondantsPagesController extends AbstractController
{
    use DomainExceptionResponseTrait;

    public function __construct(
        private readonly CorrespondantsService $correspondantsService,
    ) {
    }

    #[Route('', name: 'sof_recettes_correspondants', methods: ['GET'])]
    public function index(Request $request): JsonResponse
    {
        $periode = $request->query->get('periode_id');
        $periodeId = $periode !== null && $periode !== '' ? (int) $periode : null;

        return $this->run(fn () => new JsonResponse(
            $this->correspondantsService->obtenirRecettes($periodeId),
        ));
    }

    #[Route('/recalculer', name: 'sof_recettes_correspondants_recalculer', methods: ['POST'])]
    #[IsGranted('ROLE_CHEF_SOF')]
    public function recalculer(Request $request): JsonResponse
    {
        return $this->run(function () use ($request) {
            $payload = json_decode($request->getContent(), true);
            $payload = \is_array($payload) ? $payload : [];
            $periode = $payload['periode_id'] ?? $request->query->get('periode_id');

            return new JsonResponse(
                $this->correspondantsService->recalculerRecettes(
                    is_numeric($periode) ? (int) $periode : null,
                ),
            );
        });
    }
}
