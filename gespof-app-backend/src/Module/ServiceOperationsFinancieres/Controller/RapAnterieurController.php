<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Controller;

use App\Module\ServiceOperationsFinancieres\Service\RapAnterieurService;
use App\Shared\Controller\DomainExceptionResponseTrait;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

#[Route('/api/v1/sof/parametrage/rap-anterieurs')]
#[IsGranted('ROLE_AGENT_SOF')]
final class RapAnterieurController extends AbstractController
{
    use DomainExceptionResponseTrait;

    public function __construct(
        private readonly RapAnterieurService $rapAnterieurService,
    ) {
    }

    #[Route('/{exerciceAnnee}', name: 'sof_rap_anterieurs_obtenir', methods: ['GET'], requirements: ['exerciceAnnee' => '\d{4}'])]
    public function obtenir(int $exerciceAnnee): JsonResponse
    {
        return new JsonResponse($this->rapAnterieurService->obtenir($exerciceAnnee));
    }

    #[Route('/{exerciceAnnee}', name: 'sof_rap_anterieurs_importer', methods: ['POST'], requirements: ['exerciceAnnee' => '\d{4}'])]
    #[IsGranted('ROLE_CHEF_SOF')]
    public function importer(int $exerciceAnnee, Request $request): JsonResponse
    {
        return $this->run(fn () => new JsonResponse(
            $this->rapAnterieurService->importer($exerciceAnnee, $this->payload($request)),
            Response::HTTP_CREATED,
        ));
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
