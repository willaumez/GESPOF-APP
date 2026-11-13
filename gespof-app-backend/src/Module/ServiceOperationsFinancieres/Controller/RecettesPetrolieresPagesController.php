<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Controller;

use App\Module\ServiceOperationsFinancieres\Enum\DomaineRapprochement;
use App\Module\ServiceOperationsFinancieres\Service\ConsolidationPetroleService;
use App\Module\ServiceOperationsFinancieres\Service\DetailParSocieteService;
use App\Module\ServiceOperationsFinancieres\Service\QualificationTransfertService;
use App\Module\ServiceOperationsFinancieres\Service\RapprochementService;
use App\Module\ServiceOperationsFinancieres\Service\RecapBeacService;
use App\Shared\Controller\DomainExceptionResponseTrait;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

/**
 * Pages Recettes › Pétrolières (BEAC, qualification, consolidation, détail société).
 */
#[Route('/api/v1/sof/recettes/petrolieres')]
#[IsGranted('ROLE_AGENT_SOF')]
final class RecettesPetrolieresPagesController extends AbstractController
{
    use DomainExceptionResponseTrait;

    public function __construct(
        private readonly RecapBeacService $recapBeacService,
        private readonly QualificationTransfertService $qualificationTransfertService,
        private readonly ConsolidationPetroleService $consolidationPetroleService,
        private readonly DetailParSocieteService $detailParSocieteService,
        private readonly RapprochementService $rapprochementService,
    ) {
    }

    #[Route('/recap-beac', name: 'sof_pages_pet_recap_beac', methods: ['GET'])]
    public function recapBeac(Request $request): JsonResponse
    {
        $periode = $request->query->get('periode_id');
        $periodeId = $periode !== null && $periode !== '' ? (int) $periode : null;

        return $this->run(fn () => new JsonResponse(
            $this->recapBeacService->obtenirActif($periodeId),
        ));
    }

    #[Route('/transferts', name: 'sof_pages_pet_transferts', methods: ['GET'])]
    public function transferts(Request $request): JsonResponse
    {
        $periode = $request->query->get('periode_id');
        $periodeId = $periode !== null && $periode !== '' ? (int) $periode : null;
        $afficherNa = filter_var($request->query->get('afficher_na', false), FILTER_VALIDATE_BOOLEAN);

        return $this->run(fn () => new JsonResponse(
            $this->qualificationTransfertService->lister($periodeId, $afficherNa),
        ));
    }

    #[Route('/transferts/{id}', name: 'sof_pages_pet_transferts_enregistrer', methods: ['PUT'], requirements: ['id' => '\d+'])]
    #[IsGranted('ROLE_CHEF_SOF')]
    public function enregistrerTransfert(int $id, Request $request): JsonResponse
    {
        return $this->run(fn () => new JsonResponse([
            'qualification' => $this->qualificationTransfertService->enregistrer($id, $this->payload($request)),
        ]));
    }

    #[Route('/consolidation', name: 'sof_pages_pet_consolidation', methods: ['GET'])]
    public function consolidation(Request $request): JsonResponse
    {
        $periode = $request->query->get('periode_id');
        $periodeId = $periode !== null && $periode !== '' ? (int) $periode : null;

        return $this->run(fn () => new JsonResponse(
            $this->consolidationPetroleService->synthetiser($periodeId),
        ));
    }

    #[Route('/consolidation/recalculer', name: 'sof_pages_pet_consolidation_recalculer', methods: ['POST'])]
    #[IsGranted('ROLE_CHEF_SOF')]
    public function recalculerConsolidation(Request $request): JsonResponse
    {
        return $this->run(function () use ($request) {
            $payload = $this->payload($request);
            $periode = $payload['periode_id'] ?? null;

            return new JsonResponse(
                $this->consolidationPetroleService->recalculer(
                    is_numeric($periode) ? (int) $periode : null,
                ),
                Response::HTTP_OK,
            );
        });
    }

    #[Route('/societes', name: 'sof_pages_pet_detail_societes', methods: ['GET'])]
    public function detailSocietes(Request $request): JsonResponse
    {
        $periode = $request->query->get('periode_id');
        $periodeId = $periode !== null && $periode !== '' ? (int) $periode : null;
        $societe = $request->query->get('societe');
        $filtre = \is_string($societe) && $societe !== '' ? $societe : null;

        return $this->run(fn () => new JsonResponse(
            $this->detailParSocieteService->synthetiser($periodeId, $filtre),
        ));
    }

    #[Route('/rapprochement', name: 'sof_pages_pet_rapprochement', methods: ['GET'])]
    public function rapprochement(Request $request): JsonResponse
    {
        $periode = $request->query->get('periode_id');
        $periodeId = $periode !== null && $periode !== '' ? (int) $periode : null;

        return $this->run(fn () => new JsonResponse(
            $this->rapprochementService->listerPetrole($periodeId),
        ));
    }

    #[Route('/rapprochement/ligne', name: 'sof_pages_pet_rapprochement_ligne', methods: ['PUT'])]
    #[IsGranted('ROLE_CHEF_SOF')]
    public function enregistrerRapprochementLigne(Request $request): JsonResponse
    {
        return $this->run(function () use ($request) {
            $payload = $this->payload($request);
            $periode = $payload['periode_id'] ?? null;
            if (!is_numeric($periode)) {
                return new JsonResponse(['message' => 'periode_id requis.'], Response::HTTP_BAD_REQUEST);
            }

            return new JsonResponse([
                'ligne' => $this->rapprochementService->enregistrerLigne(
                    DomaineRapprochement::PETROLE,
                    (int) $periode,
                    $payload,
                ),
            ]);
        });
    }

    #[Route('/rapprochement/valider', name: 'sof_pages_pet_rapprochement_valider', methods: ['POST'])]
    #[IsGranted('ROLE_CHEF_SOF')]
    public function validerRapprochement(Request $request): JsonResponse
    {
        return $this->run(function () use ($request) {
            $payload = $this->payload($request);
            $periode = $payload['periode_id'] ?? null;

            return new JsonResponse(
                $this->rapprochementService->valider(
                    DomaineRapprochement::PETROLE,
                    is_numeric($periode) ? (int) $periode : null,
                ),
            );
        });
    }

    /**
     * @return array<string, mixed>
     */
    private function payload(Request $request): array
    {
        $data = json_decode($request->getContent(), true);

        return \is_array($data) ? $data : [];
    }
}
