<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Controller;

use App\Module\ServiceOperationsFinancieres\Service\CodeTofeService;
use App\Shared\Controller\DomainExceptionResponseTrait;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

#[Route('/api/v1/sof/referentiel/codes-tofe')]
#[IsGranted('ROLE_AGENT_SOF')]
final class CodeTofeController extends AbstractController
{
    use DomainExceptionResponseTrait;

    public function __construct(
        private readonly CodeTofeService $codeTofeService,
    ) {
    }

    #[Route('', name: 'sof_codes_tofe_lister', methods: ['GET'])]
    public function lister(): JsonResponse
    {
        return new JsonResponse(['codes' => $this->codeTofeService->lister()]);
    }

    #[Route('', name: 'sof_codes_tofe_creer', methods: ['POST'])]
    #[IsGranted('ROLE_CHEF_SOF')]
    public function creer(Request $request): JsonResponse
    {
        return $this->run(fn () => new JsonResponse(
            ['code_tofe' => $this->codeTofeService->creer($this->payload($request))],
            Response::HTTP_CREATED,
        ));
    }

    #[Route('/{code}', name: 'sof_codes_tofe_enregistrer', methods: ['PUT'], requirements: ['code' => '.+'])]
    #[IsGranted('ROLE_CHEF_SOF')]
    public function enregistrer(string $code, Request $request): JsonResponse
    {
        return $this->run(fn () => new JsonResponse([
            'code_tofe' => $this->codeTofeService->enregistrer($code, $this->payload($request)),
        ]));
    }

    #[Route('/{code}', name: 'sof_codes_tofe_supprimer', methods: ['DELETE'], requirements: ['code' => '.+'])]
    #[IsGranted('ROLE_CHEF_SOF')]
    public function supprimer(string $code): JsonResponse
    {
        return $this->run(function () use ($code) {
            $this->codeTofeService->supprimer($code);

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
