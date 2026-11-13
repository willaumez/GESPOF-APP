<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Controller;

use App\Module\ServiceOperationsFinancieres\Service\LoiFinancesService;
use App\Shared\Controller\DomainExceptionResponseTrait;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

#[Route('/api/v1/sof/parametrage/loi-finances')]
#[IsGranted('ROLE_AGENT_SOF')]
final class LoiFinancesController extends AbstractController
{
    use DomainExceptionResponseTrait;

    public function __construct(
        private readonly LoiFinancesService $loiFinancesService,
    ) {
    }

    #[Route('/{exerciceAnnee}', name: 'sof_loi_finances_lister', methods: ['GET'], requirements: ['exerciceAnnee' => '\d{4}'])]
    public function lister(int $exerciceAnnee): JsonResponse
    {
        return new JsonResponse([
            'lois' => $this->loiFinancesService->lister($exerciceAnnee),
        ]);
    }

    #[Route('/{exerciceAnnee}/{type}', name: 'sof_loi_finances_obtenir', methods: ['GET'], requirements: [
        'exerciceAnnee' => '\d{4}',
        'type' => 'LFI|LFR',
    ])]
    public function obtenir(int $exerciceAnnee, string $type): JsonResponse
    {
        return $this->run(fn () => new JsonResponse([
            'loi' => $this->loiFinancesService->obtenir($exerciceAnnee, $type),
        ]));
    }

    #[Route('/{exerciceAnnee}/{type}', name: 'sof_loi_finances_enregistrer', methods: ['PUT'], requirements: [
        'exerciceAnnee' => '\d{4}',
        'type' => 'LFI|LFR',
    ])]
    #[IsGranted('ROLE_CHEF_SOF')]
    public function enregistrer(int $exerciceAnnee, string $type, Request $request): JsonResponse
    {
        return $this->run(fn () => new JsonResponse([
            'loi' => $this->loiFinancesService->enregistrer(
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
