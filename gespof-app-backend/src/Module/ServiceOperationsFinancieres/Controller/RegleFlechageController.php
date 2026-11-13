<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Controller;

use App\Module\ServiceOperationsFinancieres\Service\RegleFlechageService;
use App\Shared\Controller\DomainExceptionResponseTrait;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

#[Route('/api/v1/sof/referentiel/regles-flechage')]
#[IsGranted('ROLE_AGENT_SOF')]
final class RegleFlechageController extends AbstractController
{
    use DomainExceptionResponseTrait;

    public function __construct(
        private readonly RegleFlechageService $regleFlechageService,
    ) {
    }

    #[Route('', name: 'sof_regles_flechage_lister', methods: ['GET'])]
    public function lister(Request $request): JsonResponse
    {
        $onglet = $request->query->get('onglet');
        $ongletStr = $onglet !== null && $onglet !== '' ? (string) $onglet : null;

        return $this->run(fn () => new JsonResponse([
            'regles' => $this->regleFlechageService->lister($ongletStr),
        ]));
    }

    #[Route('/tester', name: 'sof_regles_flechage_tester', methods: ['POST'])]
    public function tester(Request $request): JsonResponse
    {
        return $this->run(fn () => new JsonResponse([
            'resultat' => $this->regleFlechageService->tester($this->payload($request)),
        ]));
    }

    #[Route('/couverture', name: 'sof_regles_flechage_couverture', methods: ['GET'])]
    public function couverture(): JsonResponse
    {
        return $this->run(fn () => new JsonResponse([
            'couverture' => $this->regleFlechageService->couvertureCorrespondants(),
        ]));
    }

    #[Route('/tables-decision', name: 'sof_regles_flechage_tables', methods: ['GET'])]
    public function tablesDecision(): JsonResponse
    {
        return $this->run(fn () => new JsonResponse([
            'tables' => $this->regleFlechageService->tablesDecision(),
        ]));
    }

    #[Route('', name: 'sof_regles_flechage_creer', methods: ['POST'])]
    #[IsGranted('ROLE_CHEF_SOF')]
    public function creer(Request $request): JsonResponse
    {
        return $this->run(fn () => new JsonResponse(
            ['regle' => $this->regleFlechageService->creer($this->payload($request))],
            Response::HTTP_CREATED,
        ));
    }

    #[Route('/{id}', name: 'sof_regles_flechage_enregistrer', methods: ['PUT'], requirements: ['id' => '\d+'])]
    #[IsGranted('ROLE_CHEF_SOF')]
    public function enregistrer(int $id, Request $request): JsonResponse
    {
        return $this->run(fn () => new JsonResponse([
            'regle' => $this->regleFlechageService->enregistrer($id, $this->payload($request)),
        ]));
    }

    #[Route('/{id}', name: 'sof_regles_flechage_supprimer', methods: ['DELETE'], requirements: ['id' => '\d+'])]
    #[IsGranted('ROLE_CHEF_SOF')]
    public function supprimer(int $id): JsonResponse
    {
        return $this->run(function () use ($id) {
            $this->regleFlechageService->supprimer($id);

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
