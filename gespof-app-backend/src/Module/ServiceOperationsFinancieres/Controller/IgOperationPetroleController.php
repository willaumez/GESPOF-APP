<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Controller;

use App\Module\ServiceOperationsFinancieres\Service\IgOperationPetroleService;
use App\Shared\Controller\DomainExceptionResponseTrait;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

#[Route('/api/v1/sof/imports/ig/petrole/operations')]
#[IsGranted('ROLE_AGENT_SOF')]
final class IgOperationPetroleController extends AbstractController
{
    use DomainExceptionResponseTrait;

    public function __construct(
        private readonly IgOperationPetroleService $igOperationPetroleService,
    ) {
    }

    #[Route('', name: 'sof_ig_op_petrole_lister', methods: ['GET'])]
    public function lister(Request $request): JsonResponse
    {
        $periode = $request->query->get('periode_id');
        $periodeId = $periode !== null && $periode !== '' ? (int) $periode : null;

        return $this->run(fn () => new JsonResponse(
            $this->igOperationPetroleService->listerFeuilles($periodeId),
        ));
    }

    #[Route('/feuille', name: 'sof_ig_op_petrole_feuille', methods: ['GET'])]
    public function feuille(Request $request): JsonResponse
    {
        $compte = $request->query->getString('compte');
        $nature = $request->query->get('nature');
        $natureStr = $nature !== null && $nature !== '' ? (string) $nature : null;
        $periode = $request->query->get('periode_id');
        $periodeId = $periode !== null && $periode !== '' ? (int) $periode : null;

        return $this->run(fn () => new JsonResponse(
            $this->igOperationPetroleService->obtenirFeuille($compte, $natureStr, $periodeId),
        ));
    }

    #[Route('/importer', name: 'sof_ig_op_petrole_importer', methods: ['POST'])]
    #[IsGranted('ROLE_CHEF_SOF')]
    public function importer(Request $request): JsonResponse
    {
        return $this->run(function () use ($request) {
            $payload = $this->payload($request);
            $periode = $payload['periode_id'] ?? null;

            return new JsonResponse(
                $this->igOperationPetroleService->importer(
                    (string) ($payload['date_debut'] ?? ''),
                    (string) ($payload['date_fin'] ?? ''),
                    is_numeric($periode) ? (int) $periode : null,
                ),
                Response::HTTP_CREATED,
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
