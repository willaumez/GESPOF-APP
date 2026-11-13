<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Controller;

use App\Module\ServiceOperationsFinancieres\Service\GrilleService;
use App\Shared\Controller\DomainExceptionResponseTrait;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

#[Route('/api/v1/sof/parametrage/grilles')]
#[IsGranted('ROLE_AGENT_SOF')]
final class GrilleController extends AbstractController
{
    use DomainExceptionResponseTrait;

    public function __construct(
        private readonly GrilleService $grilleService,
    ) {
    }

    #[Route('/{exerciceAnnee}/{type}', name: 'sof_grille_obtenir', methods: ['GET'], requirements: [
        'exerciceAnnee' => '\d{4}',
        'type' => 'PLAN_[A-Z]+',
    ])]
    public function obtenir(int $exerciceAnnee, string $type): JsonResponse
    {
        return $this->run(fn () => new JsonResponse([
            'grille' => $this->grilleService->obtenir($exerciceAnnee, $type),
        ]));
    }

    #[Route('/{exerciceAnnee}/{type}', name: 'sof_grille_enregistrer', methods: ['PUT'], requirements: [
        'exerciceAnnee' => '\d{4}',
        'type' => 'PLAN_[A-Z]+',
    ])]
    #[IsGranted('ROLE_CHEF_SOF')]
    public function enregistrer(int $exerciceAnnee, string $type, Request $request): JsonResponse
    {
        return $this->run(fn () => new JsonResponse([
            'grille' => $this->grilleService->enregistrer(
                $exerciceAnnee,
                $type,
                $this->payload($request),
            ),
        ]));
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
