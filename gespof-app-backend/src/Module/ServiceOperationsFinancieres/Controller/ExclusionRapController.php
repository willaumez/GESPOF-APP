<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Controller;

use App\Module\ServiceOperationsFinancieres\Service\ExclusionRapService;
use App\Shared\Controller\DomainExceptionResponseTrait;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

#[Route('/api/v1/sof/referentiel/exclusions-rap')]
#[IsGranted('ROLE_AGENT_SOF')]
final class ExclusionRapController extends AbstractController
{
    use DomainExceptionResponseTrait;

    public function __construct(
        private readonly ExclusionRapService $exclusionRapService,
    ) {
    }

    #[Route('', name: 'sof_exclusions_rap_lister', methods: ['GET'])]
    public function lister(Request $request): JsonResponse
    {
        $type = $request->query->get('type');
        $meta = $this->exclusionRapService->meta();

        return new JsonResponse([
            'exclusions' => $this->exclusionRapService->lister(
                is_string($type) ? $type : null,
            ),
            'regles_fixes' => $meta['regles_fixes'],
            'natures' => $meta['natures'],
        ]);
    }

    #[Route('', name: 'sof_exclusions_rap_creer', methods: ['POST'])]
    #[IsGranted('ROLE_CHEF_SOF')]
    public function creer(Request $request): JsonResponse
    {
        return $this->run(fn () => new JsonResponse(
            ['exclusion' => $this->exclusionRapService->creer($this->payload($request))],
            Response::HTTP_CREATED,
        ));
    }

    #[Route('/{id}', name: 'sof_exclusions_rap_supprimer', methods: ['DELETE'], requirements: ['id' => '\d+'])]
    #[IsGranted('ROLE_CHEF_SOF')]
    public function supprimer(int $id, Request $request): JsonResponse
    {
        return $this->run(function () use ($id, $request) {
            $payload = $this->payload($request);
            $motif = isset($payload['motif']) ? (string) $payload['motif'] : null;
            $this->exclusionRapService->supprimer($id, $motif);

            return new JsonResponse(null, Response::HTTP_NO_CONTENT);
        });
    }

    /**
     * @return array<string, mixed>
     */
    private function payload(Request $request): array
    {
        $donnees = json_decode($request->getContent(), true);

        return is_array($donnees) ? $donnees : [];
    }
}
