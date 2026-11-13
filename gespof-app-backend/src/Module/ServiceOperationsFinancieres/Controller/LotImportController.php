<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Controller;

use App\Module\ServiceOperationsFinancieres\Service\LotImportService;
use App\Shared\Controller\DomainExceptionResponseTrait;
use App\Shared\Entite\Utilisateur;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

#[Route('/api/v1/sof/imports/lots')]
#[IsGranted('ROLE_AGENT_SOF')]
final class LotImportController extends AbstractController
{
    use DomainExceptionResponseTrait;

    public function __construct(
        private readonly LotImportService $lotImportService,
    ) {
    }

    #[Route('', name: 'sof_lots_import_lister', methods: ['GET'])]
    public function lister(Request $request): JsonResponse
    {
        $periode = $request->query->get('periode_id');
        $periodeId = $periode !== null && $periode !== '' ? (int) $periode : null;
        $statut = $request->query->get('statut');
        $statutStr = $statut !== null && $statut !== '' ? (string) $statut : null;

        return $this->run(fn () => new JsonResponse([
            'lots' => $this->lotImportService->lister($periodeId, $statutStr),
        ]));
    }

    #[Route('/comparer', name: 'sof_lots_import_comparer', methods: ['POST'])]
    public function comparer(Request $request): JsonResponse
    {
        return $this->run(function () use ($request) {
            $payload = $this->payload($request);
            $ids = $payload['lot_ids'] ?? $payload['ids'] ?? [];
            if (!is_array($ids)) {
                $ids = [];
            }

            return new JsonResponse([
                'comparaison' => $this->lotImportService->comparer(
                    array_map(static fn ($id): int => (int) $id, array_values($ids)),
                ),
            ]);
        });
    }

    #[Route('/{id}', name: 'sof_lots_import_obtenir', methods: ['GET'], requirements: ['id' => '\d+'])]
    public function obtenir(int $id): JsonResponse
    {
        return $this->run(fn () => new JsonResponse([
            'lot' => $this->lotImportService->obtenir($id),
        ]));
    }

    #[Route('/{id}/anomalies', name: 'sof_lots_import_anomalies', methods: ['GET'], requirements: ['id' => '\d+'])]
    public function anomalies(int $id): JsonResponse
    {
        return $this->run(fn () => new JsonResponse([
            'anomalies' => $this->lotImportService->listerAnomalies($id),
        ]));
    }

    #[Route('/{id}/annuler', name: 'sof_lots_import_annuler', methods: ['POST'], requirements: ['id' => '\d+'])]
    #[IsGranted('ROLE_CHEF_SOF')]
    public function annuler(int $id, Request $request): JsonResponse
    {
        return $this->run(function () use ($id, $request) {
            $user = $this->getUser();
            $acteur = $user instanceof Utilisateur ? $user : null;

            return new JsonResponse([
                'lot' => $this->lotImportService->annuler($id, $this->payload($request), $acteur),
            ]);
        });
    }

    /**
     * @return array<string, mixed>
     */
    private function payload(Request $request): array
    {
        $donnees = json_decode($request->getContent(), true);
        if (!is_array($donnees)) {
            $donnees = [];
        }

        return $donnees;
    }
}
