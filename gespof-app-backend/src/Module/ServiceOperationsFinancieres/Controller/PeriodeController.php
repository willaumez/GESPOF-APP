<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Controller;

use App\Module\ServiceOperationsFinancieres\Service\PeriodeService;
use App\Shared\Controller\DomainExceptionResponseTrait;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

#[Route('/api/v1/sof/referentiel/periodes')]
#[IsGranted('ROLE_AGENT_SOF')]
final class PeriodeController extends AbstractController
{
    use DomainExceptionResponseTrait;

    public function __construct(
        private readonly PeriodeService $periodeService,
    ) {
    }

    #[Route('', name: 'sof_periodes_lister', methods: ['GET'])]
    public function lister(Request $request): JsonResponse
    {
        $exercice = $request->query->get('exercice');
        $annee = $exercice !== null && $exercice !== '' ? (int) $exercice : null;

        return new JsonResponse(['periodes' => $this->periodeService->lister($annee)]);
    }

    #[Route('/{id}', name: 'sof_periodes_obtenir', methods: ['GET'], requirements: ['id' => '\d+'])]
    public function obtenir(int $id): JsonResponse
    {
        return $this->run(fn () => new JsonResponse([
            'periode' => $this->periodeService->obtenir($id),
        ]));
    }

    #[Route('', name: 'sof_periodes_ouvrir', methods: ['POST'])]
    #[IsGranted('ROLE_CHEF_SOF')]
    public function ouvrir(Request $request): JsonResponse
    {
        return $this->run(function () use ($request) {
            $donnees = $this->payload($request);
            if (!isset($donnees['exercice_annee'], $donnees['mois'])) {
                return new JsonResponse(
                    ['message' => 'exercice_annee et mois sont obligatoires.'],
                    Response::HTTP_BAD_REQUEST,
                );
            }

            return new JsonResponse(
                [
                    'periode' => $this->periodeService->ouvrir(
                        (int) $donnees['exercice_annee'],
                        (int) $donnees['mois'],
                    ),
                ],
                Response::HTTP_CREATED,
            );
        });
    }

    #[Route('/{id}', name: 'sof_periodes_enregistrer', methods: ['PUT'], requirements: ['id' => '\d+'])]
    #[IsGranted('ROLE_CHEF_SOF')]
    public function enregistrer(int $id, Request $request): JsonResponse
    {
        return $this->run(fn () => new JsonResponse([
            'periode' => $this->periodeService->enregistrer($id, $this->payload($request)),
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
