<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Controller;

use App\Module\ServiceOperationsFinancieres\Service\ExerciceService;
use App\Shared\Controller\DomainExceptionResponseTrait;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

#[Route('/api/v1/sof/referentiel/exercices')]
#[IsGranted('ROLE_AGENT_SOF')]
final class ExerciceController extends AbstractController
{
    use DomainExceptionResponseTrait;

    public function __construct(
        private readonly ExerciceService $exerciceService,
    ) {
    }

    #[Route('', name: 'sof_exercices_lister', methods: ['GET'])]
    public function lister(): JsonResponse
    {
        return new JsonResponse(['exercices' => $this->exerciceService->lister()]);
    }

    #[Route('/courant', name: 'sof_exercices_courant', methods: ['GET'])]
    public function courant(): JsonResponse
    {
        $exercice = $this->exerciceService->courant();
        if ($exercice === null) {
            return new JsonResponse(['exercice' => null], Response::HTTP_OK);
        }

        return new JsonResponse(['exercice' => $exercice]);
    }

    #[Route('/{annee}', name: 'sof_exercices_obtenir', methods: ['GET'], requirements: ['annee' => '\d{4}'])]
    public function obtenir(int $annee): JsonResponse
    {
        return $this->run(fn () => new JsonResponse([
            'exercice' => $this->exerciceService->obtenir($annee),
        ]));
    }

    #[Route('/{annee}', name: 'sof_exercices_enregistrer', methods: ['PUT'], requirements: ['annee' => '\d{4}'])]
    #[IsGranted('ROLE_CHEF_SOF')]
    public function enregistrer(int $annee, Request $request): JsonResponse
    {
        return $this->run(fn () => new JsonResponse([
            'exercice' => $this->exerciceService->enregistrer($annee, $this->payload($request)),
        ]));
    }

    #[Route('', name: 'sof_exercices_ouvrir', methods: ['POST'])]
    #[IsGranted('ROLE_CHEF_SOF')]
    public function ouvrir(Request $request): JsonResponse
    {
        return $this->run(function () use ($request) {
            $donnees = $this->payload($request);
            $anneeSource = isset($donnees['annee_source']) ? (int) $donnees['annee_source'] : null;

            return new JsonResponse(
                ['exercice' => $this->exerciceService->ouvrirNouvelExercice($anneeSource)],
                Response::HTTP_CREATED,
            );
        });
    }

    #[Route('/{annee}/cloturer', name: 'sof_exercices_cloturer', methods: ['POST'], requirements: ['annee' => '\d{4}'])]
    #[IsGranted('ROLE_CHEF_SOF')]
    public function cloturer(int $annee): JsonResponse
    {
        return $this->run(fn () => new JsonResponse([
            'exercice' => $this->exerciceService->cloturer($annee),
        ]));
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
