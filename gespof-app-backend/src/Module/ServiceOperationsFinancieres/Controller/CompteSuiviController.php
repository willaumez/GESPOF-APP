<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Controller;

use App\Module\ServiceOperationsFinancieres\Service\CompteSuiviService;
use App\Shared\Controller\DomainExceptionResponseTrait;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

#[Route('/api/v1/sof/referentiel/comptes-suivi')]
#[IsGranted('ROLE_AGENT_SOF')]
final class CompteSuiviController extends AbstractController
{
    use DomainExceptionResponseTrait;

    public function __construct(
        private readonly CompteSuiviService $compteSuiviService,
    ) {
    }

    #[Route('', name: 'sof_comptes_suivi_lister', methods: ['GET'])]
    public function lister(): JsonResponse
    {
        return new JsonResponse(['comptes' => $this->compteSuiviService->lister()]);
    }

    #[Route('', name: 'sof_comptes_suivi_creer', methods: ['POST'])]
    #[IsGranted('ROLE_CHEF_SOF')]
    public function creer(Request $request): JsonResponse
    {
        return $this->run(fn () => new JsonResponse(
            ['compte' => $this->compteSuiviService->creer($this->payload($request))],
            Response::HTTP_CREATED,
        ));
    }

    #[Route(
        '/{compte}/{nature}',
        name: 'sof_comptes_suivi_enregistrer',
        methods: ['PUT'],
        requirements: ['compte' => '.+', 'nature' => '.+'],
    )]
    #[IsGranted('ROLE_CHEF_SOF')]
    public function enregistrer(string $compte, string $nature, Request $request): JsonResponse
    {
        return $this->run(fn () => new JsonResponse([
            'compte' => $this->compteSuiviService->enregistrer(
                rawurldecode($compte),
                rawurldecode($nature),
                $this->payload($request),
            ),
        ]));
    }

    #[Route(
        '/{compte}/{nature}',
        name: 'sof_comptes_suivi_supprimer',
        methods: ['DELETE'],
        requirements: ['compte' => '.+', 'nature' => '.+'],
    )]
    #[IsGranted('ROLE_CHEF_SOF')]
    public function supprimer(string $compte, string $nature): JsonResponse
    {
        return $this->run(function () use ($compte, $nature) {
            $this->compteSuiviService->supprimer(rawurldecode($compte), rawurldecode($nature));

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
