<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Controller;

use App\Module\ServiceOperationsFinancieres\Service\AjustementsService;
use App\Shared\Controller\DomainExceptionResponseTrait;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

#[Route('/api/v1/sof/ajustements')]
#[IsGranted('ROLE_AGENT_SOF')]
final class AjustementsController extends AbstractController
{
    use DomainExceptionResponseTrait;

    public function __construct(
        private readonly AjustementsService $ajustementsService,
    ) {
    }

    #[Route('/nomenclature', name: 'sof_ajustements_nomenclature', methods: ['GET'])]
    public function nomenclature(Request $request): JsonResponse
    {
        $nature = $request->query->get('nature');

        return $this->run(fn () => new JsonResponse(
            $this->ajustementsService->nomenclature(
                $nature !== null && $nature !== '' ? (string) $nature : null,
            ),
        ));
    }

    #[Route('', name: 'sof_ajustements_lister', methods: ['GET'])]
    public function lister(Request $request): JsonResponse
    {
        $periode = $request->query->get('periode_id');
        $periodeId = $periode !== null && $periode !== '' ? (int) $periode : null;

        return $this->run(fn () => new JsonResponse(
            $this->ajustementsService->lister($periodeId),
        ));
    }

    #[Route('', name: 'sof_ajustements_creer', methods: ['POST'])]
    #[IsGranted('ROLE_AGENT_SOF')]
    public function creer(Request $request): JsonResponse
    {
        return $this->run(fn () => new JsonResponse(
            $this->ajustementsService->creer($this->payload($request)),
            Response::HTTP_CREATED,
        ));
    }

    #[Route('/{id}/contre-passer', name: 'sof_ajustements_contre_passer', methods: ['POST'], requirements: ['id' => '\d+'])]
    #[IsGranted('ROLE_AGENT_SOF')]
    public function contrePasser(int $id, Request $request): JsonResponse
    {
        return $this->run(function () use ($id, $request) {
            $payload = $this->payload($request);

            return new JsonResponse(
                $this->ajustementsService->contrePasser(
                    $id,
                    isset($payload['motif']) ? (string) $payload['motif'] : null,
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
