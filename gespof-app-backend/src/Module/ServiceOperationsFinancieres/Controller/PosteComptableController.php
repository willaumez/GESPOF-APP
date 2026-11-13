<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Controller;

use App\Module\ServiceOperationsFinancieres\Service\PosteComptableService;
use App\Shared\Controller\DomainExceptionResponseTrait;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

#[Route('/api/v1/sof/referentiel/postes-comptables')]
#[IsGranted('ROLE_AGENT_SOF')]
final class PosteComptableController extends AbstractController
{
    use DomainExceptionResponseTrait;

    public function __construct(
        private readonly PosteComptableService $posteComptableService,
    ) {
    }

    #[Route('', name: 'sof_postes_comptables_lister', methods: ['GET'])]
    public function lister(): JsonResponse
    {
        return new JsonResponse(['postes' => $this->posteComptableService->lister()]);
    }

    #[Route('', name: 'sof_postes_comptables_creer', methods: ['POST'])]
    #[IsGranted('ROLE_CHEF_SOF')]
    public function creer(Request $request): JsonResponse
    {
        return $this->run(fn () => new JsonResponse(
            ['poste' => $this->posteComptableService->creer($this->payload($request))],
            Response::HTTP_CREATED,
        ));
    }

    #[Route('/{code}', name: 'sof_postes_comptables_enregistrer', methods: ['PUT'], requirements: ['code' => '.+'])]
    #[IsGranted('ROLE_CHEF_SOF')]
    public function enregistrer(string $code, Request $request): JsonResponse
    {
        return $this->run(fn () => new JsonResponse([
            'poste' => $this->posteComptableService->enregistrer(
                rawurldecode($code),
                $this->payload($request),
            ),
        ]));
    }

    #[Route('/{code}', name: 'sof_postes_comptables_supprimer', methods: ['DELETE'], requirements: ['code' => '.+'])]
    #[IsGranted('ROLE_CHEF_SOF')]
    public function supprimer(string $code): JsonResponse
    {
        return $this->run(function () use ($code) {
            $this->posteComptableService->supprimer(rawurldecode($code));

            return new JsonResponse(null, Response::HTTP_NO_CONTENT);
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
