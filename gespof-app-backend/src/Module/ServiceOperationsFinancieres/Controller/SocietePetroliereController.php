<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Controller;

use App\Module\ServiceOperationsFinancieres\Service\SocietePetroliereService;
use App\Shared\Controller\DomainExceptionResponseTrait;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

#[Route('/api/v1/sof/referentiel/societes-petrolieres')]
#[IsGranted('ROLE_AGENT_SOF')]
final class SocietePetroliereController extends AbstractController
{
    use DomainExceptionResponseTrait;

    public function __construct(
        private readonly SocietePetroliereService $societePetroliereService,
    ) {
    }

    #[Route('', name: 'sof_societes_petrolieres_lister', methods: ['GET'])]
    public function lister(): JsonResponse
    {
        return new JsonResponse(['societes' => $this->societePetroliereService->lister()]);
    }

    #[Route('', name: 'sof_societes_petrolieres_creer', methods: ['POST'])]
    #[IsGranted('ROLE_CHEF_SOF')]
    public function creer(Request $request): JsonResponse
    {
        return $this->run(fn () => new JsonResponse(
            ['societe' => $this->societePetroliereService->creer($this->payload($request))],
            Response::HTTP_CREATED,
        ));
    }

    #[Route(
        '/{matricule}',
        name: 'sof_societes_petrolieres_enregistrer',
        methods: ['PUT'],
        requirements: ['matricule' => '.+'],
    )]
    #[IsGranted('ROLE_CHEF_SOF')]
    public function enregistrer(string $matricule, Request $request): JsonResponse
    {
        return $this->run(fn () => new JsonResponse([
            'societe' => $this->societePetroliereService->enregistrer(
                rawurldecode($matricule),
                $this->payload($request),
            ),
        ]));
    }

    #[Route(
        '/{matricule}',
        name: 'sof_societes_petrolieres_supprimer',
        methods: ['DELETE'],
        requirements: ['matricule' => '.+'],
    )]
    #[IsGranted('ROLE_CHEF_SOF')]
    public function supprimer(string $matricule): JsonResponse
    {
        return $this->run(function () use ($matricule) {
            $this->societePetroliereService->supprimer(rawurldecode($matricule));

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
