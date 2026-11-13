<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Controller;

use App\Module\ServiceOperationsFinancieres\Enum\DomaineRapprochement;
use App\Module\ServiceOperationsFinancieres\Service\RapprochementService;
use App\Module\ServiceOperationsFinancieres\Service\VueAnnuelleDouanesService;
use App\Shared\Controller\DomainExceptionResponseTrait;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

#[Route('/api/v1/sof/recettes/douanieres')]
#[IsGranted('ROLE_AGENT_SOF')]
final class RecettesDouanieresPagesController extends AbstractController
{
    use DomainExceptionResponseTrait;

    public function __construct(
        private readonly RapprochementService $rapprochementService,
        private readonly VueAnnuelleDouanesService $vueAnnuelleDouanesService,
    ) {
    }

    #[Route('/rapprochement', name: 'sof_pages_dou_rapprochement', methods: ['GET'])]
    public function rapprochement(Request $request): JsonResponse
    {
        $periode = $request->query->get('periode_id');
        $periodeId = $periode !== null && $periode !== '' ? (int) $periode : null;

        return $this->run(fn () => new JsonResponse(
            $this->rapprochementService->listerDouane($periodeId),
        ));
    }

    #[Route('/rapprochement/ligne', name: 'sof_pages_dou_rapprochement_ligne', methods: ['PUT'])]
    #[IsGranted('ROLE_CHEF_SOF')]
    public function enregistrerRapprochementLigne(Request $request): JsonResponse
    {
        return $this->run(function () use ($request) {
            $payload = $this->payload($request);
            $periode = $payload['periode_id'] ?? null;
            if (!is_numeric($periode)) {
                return new JsonResponse(['message' => 'periode_id requis.'], Response::HTTP_BAD_REQUEST);
            }

            return new JsonResponse([
                'ligne' => $this->rapprochementService->enregistrerLigne(
                    DomaineRapprochement::DOUANE,
                    (int) $periode,
                    $payload,
                ),
            ]);
        });
    }

    #[Route('/rapprochement/valider', name: 'sof_pages_dou_rapprochement_valider', methods: ['POST'])]
    #[IsGranted('ROLE_CHEF_SOF')]
    public function validerRapprochement(Request $request): JsonResponse
    {
        return $this->run(function () use ($request) {
            $payload = $this->payload($request);
            $periode = $payload['periode_id'] ?? null;

            return new JsonResponse(
                $this->rapprochementService->valider(
                    DomaineRapprochement::DOUANE,
                    is_numeric($periode) ? (int) $periode : null,
                ),
            );
        });
    }

    #[Route('/annuelle', name: 'sof_pages_dou_annuelle', methods: ['GET'])]
    public function annuelle(Request $request): JsonResponse
    {
        $periode = $request->query->get('periode_id');
        $periodeId = $periode !== null && $periode !== '' ? (int) $periode : null;

        return $this->run(fn () => new JsonResponse(
            $this->vueAnnuelleDouanesService->synthetiser($periodeId),
        ));
    }

    #[Route('/annuelle/recalculer', name: 'sof_pages_dou_annuelle_recalculer', methods: ['POST'])]
    #[IsGranted('ROLE_CHEF_SOF')]
    public function recalculerAnnuelle(Request $request): JsonResponse
    {
        return $this->run(function () use ($request) {
            $payload = $this->payload($request);
            $periode = $payload['periode_id'] ?? null;

            return new JsonResponse(
                $this->vueAnnuelleDouanesService->recalculer(
                    is_numeric($periode) ? (int) $periode : null,
                ),
            );
        });
    }

    /**
     * @return array<string, mixed>
     */
    private function payload(Request $request): array
    {
        $data = json_decode($request->getContent(), true);

        return \is_array($data) ? $data : [];
    }
}
