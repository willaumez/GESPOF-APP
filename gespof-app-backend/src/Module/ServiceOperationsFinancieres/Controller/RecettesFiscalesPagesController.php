<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Controller;

use App\Module\ServiceOperationsFinancieres\Service\RecettesFiscalesAppariementService;
use App\Module\ServiceOperationsFinancieres\Service\RecettesFiscalesModeService;
use App\Shared\Controller\DomainExceptionResponseTrait;
use App\Shared\Exception\DonneesInvalidesException;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

/**
 * Recettes › Fiscales (DGI) › Par mode de recouvrement + appariement.
 */
#[Route('/api/v1/sof/recettes/fiscales')]
#[IsGranted('ROLE_AGENT_SOF')]
final class RecettesFiscalesPagesController extends AbstractController
{
    use DomainExceptionResponseTrait;

    public function __construct(
        private readonly RecettesFiscalesModeService $recettesFiscalesModeService,
        private readonly RecettesFiscalesAppariementService $recettesFiscalesAppariementService,
    ) {
    }

    #[Route('/appariement', name: 'sof_recettes_fiscales_appariement', methods: ['GET'])]
    public function appariement(Request $request): JsonResponse
    {
        $periode = $request->query->get('periode_id');
        $periodeId = $periode !== null && $periode !== '' ? (int) $periode : null;

        return $this->run(fn () => new JsonResponse(
            $this->recettesFiscalesAppariementService->obtenir($periodeId),
        ));
    }

    #[Route('/mode', name: 'sof_recettes_fiscales_mode', methods: ['GET'])]
    public function mode(Request $request): JsonResponse
    {
        $periode = $request->query->get('periode_id');
        $periodeId = $periode !== null && $periode !== '' ? (int) $periode : null;

        return $this->run(fn () => new JsonResponse(
            $this->recettesFiscalesModeService->obtenir($periodeId),
        ));
    }

    #[Route('/mode', name: 'sof_recettes_fiscales_mode_enregistrer', methods: ['PUT'])]
    #[IsGranted('ROLE_CHEF_SOF')]
    public function enregistrerMode(Request $request): JsonResponse
    {
        return $this->run(function () use ($request) {
            $data = json_decode($request->getContent(), true);
            $payload = \is_array($data) ? $data : [];
            $periode = $payload['periode_id'] ?? null;
            $lignes = $payload['lignes'] ?? null;
            if (!\is_array($lignes)) {
                throw new DonneesInvalidesException('Liste « lignes » requise ([{rubrique_code, mode, montant}]).');
            }
            /** @var list<array<string, mixed>> $liste */
            $liste = array_values(array_filter($lignes, '\is_array'));

            return new JsonResponse(
                $this->recettesFiscalesModeService->enregistrer(
                    is_numeric($periode) ? (int) $periode : null,
                    $liste,
                ),
            );
        });
    }
}
