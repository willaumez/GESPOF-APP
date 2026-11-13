<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Controller;

use App\Module\ServiceOperationsFinancieres\Service\DepensesAutomatiseesService;
use App\Shared\Controller\DomainExceptionResponseTrait;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

#[Route('/api/v1/sof/depenses/automatisees')]
#[IsGranted('ROLE_AGENT_SOF')]
final class DepensesAutomatiseesController extends AbstractController
{
    use DomainExceptionResponseTrait;

    public function __construct(
        private readonly DepensesAutomatiseesService $depensesAutomatiseesService,
    ) {
    }

    #[Route('/{page}', name: 'sof_depenses_automatisees_page', methods: ['GET'], requirements: ['page' => 'ordonnances|credits-delegues|avances|correspondants'])]
    public function index(string $page, Request $request): JsonResponse
    {
        $periode = $request->query->get('periode_id');
        $periodeId = $periode !== null && $periode !== '' ? (int) $periode : null;

        return $this->run(fn () => new JsonResponse(
            $this->depensesAutomatiseesService->obtenir(
                $page,
                $periodeId,
                (string) $request->query->get('vue', 'agregee'),
                (string) $request->query->get('affichage', 'mois'),
                [
                    'lignes' => $request->query->get('lignes'),
                    'search' => $request->query->get('search'),
                    'code' => $request->query->get('code'),
                    'titre' => $request->query->get('titre'),
                ],
            ),
        ));
    }

    #[Route('/{page}/recalculer', name: 'sof_depenses_automatisees_recalculer', methods: ['POST'], requirements: ['page' => 'ordonnances|credits-delegues|avances|correspondants'])]
    #[IsGranted('ROLE_CHEF_SOF')]
    public function recalculer(string $page, Request $request): JsonResponse
    {
        return $this->run(function () use ($page, $request) {
            $payload = $this->payload($request);
            $periode = $payload['periode_id'] ?? null;

            return new JsonResponse(
                $this->depensesAutomatiseesService->recalculer(
                    $page,
                    is_numeric($periode) ? (int) $periode : null,
                    (string) ($payload['vue'] ?? 'agregee'),
                    (string) ($payload['affichage'] ?? 'mois'),
                    [
                        'lignes' => $payload['lignes'] ?? null,
                        'search' => $payload['search'] ?? null,
                        'code' => $payload['code'] ?? null,
                        'titre' => $payload['titre'] ?? null,
                    ],
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
