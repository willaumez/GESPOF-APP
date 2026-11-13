<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Controller;

use App\Module\ServiceOperationsFinancieres\Service\ExtractionOrchestrateurService;
use App\Shared\Controller\DomainExceptionResponseTrait;
use App\Shared\Exception\DonneesInvalidesException;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

/**
 * Page unifiée « Extractions DC / IG ».
 */
#[Route('/api/v1/sof/extractions')]
#[IsGranted('ROLE_AGENT_SOF')]
final class ExtractionController extends AbstractController
{
    use DomainExceptionResponseTrait;

    public function __construct(
        private readonly ExtractionOrchestrateurService $orchestrateur,
    ) {
    }

    #[Route('/definitions', name: 'sof_extractions_definitions', methods: ['GET'])]
    public function definitions(): JsonResponse
    {
        return $this->run(fn () => new JsonResponse($this->orchestrateur->definitions()));
    }

    #[Route('/statuts', name: 'sof_extractions_statuts', methods: ['GET'])]
    public function statuts(Request $request): JsonResponse
    {
        return $this->run(function () use ($request) {
            $periode = $request->query->get('periode');
            if ($periode === null || $periode === '') {
                $periode = $request->query->get('periode_id');
            }
            $periodeId = $periode !== null && $periode !== '' ? (int) $periode : null;
            $dateSituation = $request->query->get('date_situation');
            $dateSituation = is_string($dateSituation) && $dateSituation !== '' ? $dateSituation : null;

            return new JsonResponse($this->orchestrateur->statuts($periodeId, $dateSituation));
        });
    }

    #[Route('/executer', name: 'sof_extractions_executer', methods: ['POST'])]
    #[IsGranted('ROLE_CHEF_SOF')]
    public function executer(Request $request): JsonResponse
    {
        set_time_limit(30);

        return $this->run(function () use ($request) {
            $payload = $this->payload($request);
            $periodeId = $payload['periodeId'] ?? $payload['periode_id'] ?? null;
            if (!is_numeric($periodeId)) {
                throw new DonneesInvalidesException('periodeId requis.');
            }
            $codes = $payload['codes'] ?? [];
            if (!is_array($codes) || $codes === []) {
                throw new DonneesInvalidesException('Au moins un code d\'extraction est requis.');
            }
            /** @var list<string> $codesNorm */
            $codesNorm = array_values(array_filter(
                array_map(static fn ($c): string => is_string($c) ? trim($c) : '', $codes),
                static fn (string $c): bool => $c !== '',
            ));
            if ($codesNorm === []) {
                throw new DonneesInvalidesException('Aucun code d\'extraction valide.');
            }
            $dateSituation = isset($payload['date_situation']) && is_string($payload['date_situation'])
                ? $payload['date_situation']
                : (isset($payload['dateSituation']) && is_string($payload['dateSituation'])
                    ? $payload['dateSituation']
                    : null);

            $surcharges = $payload['surcharges'] ?? null;
            if (!is_array($surcharges)) {
                $surcharges = null;
            }

            $lancement = $this->orchestrateur->creerLancement(
                (int) $periodeId,
                $codesNorm,
                $dateSituation,
                $surcharges,
            );

            return new JsonResponse($lancement, Response::HTTP_ACCEPTED);
        });
    }

    #[Route('/lancements/{id}', name: 'sof_extractions_lancement', methods: ['GET'], requirements: ['id' => '\d+'])]
    public function lancement(int $id): JsonResponse
    {
        return $this->run(fn () => new JsonResponse($this->orchestrateur->obtenirLancement($id)));
    }

    #[Route('/lancements/{id}/avancer', name: 'sof_extractions_avancer', methods: ['POST'], requirements: ['id' => '\d+'])]
    #[IsGranted('ROLE_CHEF_SOF')]
    public function avancer(int $id): JsonResponse
    {
        set_time_limit(300);

        return $this->run(fn () => new JsonResponse($this->orchestrateur->avancer($id)));
    }

    #[Route('/lancements/{id}/annuler', name: 'sof_extractions_annuler', methods: ['POST'], requirements: ['id' => '\d+'])]
    #[IsGranted('ROLE_CHEF_SOF')]
    public function annuler(int $id): JsonResponse
    {
        return $this->run(fn () => new JsonResponse($this->orchestrateur->annuler($id)));
    }

    /**
     * @return array<string, mixed>
     */
    private function payload(Request $request): array
    {
        $data = json_decode($request->getContent(), true);

        return is_array($data) ? $data : [];
    }
}
