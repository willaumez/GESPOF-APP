<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Controller;

use App\Module\ServiceOperationsFinancieres\Service\RdModelCumulService;
use App\Shared\Controller\DomainExceptionResponseTrait;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

#[Route('/api/v1/sof/rd-model')]
#[IsGranted('ROLE_AGENT_SOF')]
final class RdModelCumulController extends AbstractController
{
    use DomainExceptionResponseTrait;

    public function __construct(
        private readonly RdModelCumulService $rdModelCumulService,
    ) {
    }

    #[Route('/cumul/recalculer', name: 'sof_rd_model_cumul_recalculer', methods: ['POST'])]
    #[IsGranted('ROLE_CHEF_SOF')]
    public function recalculer(Request $request): JsonResponse
    {
        return $this->run(function () use ($request) {
            $payload = json_decode($request->getContent(), true);
            $payload = \is_array($payload) ? $payload : [];
            $annee = isset($payload['exercice']) ? (int) $payload['exercice'] : 0;
            if ($annee <= 0 && isset($payload['periode_id'])) {
                $etat = $this->rdModelCumulService->etatDepenses(
                    is_numeric($payload['periode_id']) ? (int) $payload['periode_id'] : null,
                );
                $annee = (int) $etat['exercice'];
            }
            if ($annee <= 0) {
                $etat = $this->rdModelCumulService->etatDepenses(null);
                $annee = (int) $etat['exercice'];
            }

            return new JsonResponse([
                'cumul' => $this->rdModelCumulService->recalculerAuto($annee),
            ]);
        });
    }

    #[Route('/depenses', name: 'sof_rd_model_depenses', methods: ['GET'])]
    public function depenses(Request $request): JsonResponse
    {
        $periode = $request->query->get('periode_id');
        $periodeId = $periode !== null && $periode !== '' ? (int) $periode : null;
        $mode = (string) $request->query->get('mode', 'auto');

        return $this->run(fn () => new JsonResponse([
            'etat' => $this->rdModelCumulService->etatDepenses($periodeId, $mode),
        ]));
    }

    #[Route('/recettes', name: 'sof_rd_model_recettes', methods: ['GET'])]
    public function recettes(Request $request): JsonResponse
    {
        $periode = $request->query->get('periode_id');
        $periodeId = $periode !== null && $periode !== '' ? (int) $periode : null;
        $mode = (string) $request->query->get('mode', 'auto');

        return $this->run(fn () => new JsonResponse([
            'etat' => $this->rdModelCumulService->etatRecettes($periodeId, $mode),
        ]));
    }
}
