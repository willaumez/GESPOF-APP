<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Controller;

use App\Module\ServiceOperationsFinancieres\Service\RecapBeacService;
use App\Shared\Controller\DomainExceptionResponseTrait;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

#[Route('/api/v1/sof/imports/ig/petrole/recap-beac')]
#[IsGranted('ROLE_AGENT_SOF')]
final class RecapBeacController extends AbstractController
{
    use DomainExceptionResponseTrait;

    public function __construct(
        private readonly RecapBeacService $recapBeacService,
    ) {
    }

    #[Route('', name: 'sof_recap_beac_obtenir', methods: ['GET'])]
    public function obtenir(Request $request): JsonResponse
    {
        $periode = $request->query->get('periode_id');
        $periodeId = $periode !== null && $periode !== '' ? (int) $periode : null;

        return $this->run(fn () => new JsonResponse(
            $this->recapBeacService->obtenirActif($periodeId),
        ));
    }

    #[Route('/importer', name: 'sof_recap_beac_importer', methods: ['POST'])]
    #[IsGranted('ROLE_CHEF_SOF')]
    public function importer(Request $request): JsonResponse
    {
        return $this->run(function () use ($request) {
            $payload = $this->payload($request);
            $periode = $payload['periode_id'] ?? null;

            return new JsonResponse(
                $this->recapBeacService->importer(
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
