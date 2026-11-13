<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Controller;

use App\Module\ServiceOperationsFinancieres\Service\TvaRecettesService;
use App\Shared\Controller\DomainExceptionResponseTrait;
use App\Shared\Exception\DonneesInvalidesException;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

/**
 * Recettes › TVA (rapprochement DC ↔ IG, remboursements, RAP, TOFE, taux de change).
 */
#[Route('/api/v1/sof/recettes/tva')]
#[IsGranted('ROLE_AGENT_SOF')]
final class RecettesTvaPagesController extends AbstractController
{
    use DomainExceptionResponseTrait;

    public function __construct(
        private readonly TvaRecettesService $tvaRecettesService,
    ) {
    }

    #[Route('/rapprochement', name: 'sof_recettes_tva_rapprochement', methods: ['GET'])]
    public function rapprochement(Request $request): JsonResponse
    {
        return $this->run(fn () => new JsonResponse(
            $this->tvaRecettesService->obtenirRapprochement($this->periodeId($request)),
        ));
    }

    #[Route('/rapprochement/recalculer', name: 'sof_recettes_tva_rapprochement_recalculer', methods: ['POST'])]
    #[IsGranted('ROLE_CHEF_SOF')]
    public function recalculer(Request $request): JsonResponse
    {
        return $this->run(function () use ($request) {
            $payload = $this->payload($request);
            $periode = $payload['periode_id'] ?? $request->query->get('periode_id');

            return new JsonResponse(
                $this->tvaRecettesService->recalculerRapprochement(
                    is_numeric($periode) ? (int) $periode : null,
                ),
            );
        });
    }

    #[Route('/remboursements', name: 'sof_recettes_tva_remboursements', methods: ['GET'])]
    public function remboursements(Request $request): JsonResponse
    {
        return $this->run(fn () => new JsonResponse(
            $this->tvaRecettesService->obtenirRemboursements($this->periodeId($request)),
        ));
    }

    #[Route('/remboursements/recalculer', name: 'sof_recettes_tva_remboursements_recalculer', methods: ['POST'])]
    #[IsGranted('ROLE_CHEF_SOF')]
    public function recalculerRemboursements(Request $request): JsonResponse
    {
        return $this->run(function () use ($request) {
            $payload = $this->payload($request);
            $periode = $payload['periode_id'] ?? $request->query->get('periode_id');

            return new JsonResponse([
                'srot' => $this->tvaRecettesService->recalculerRemboursementsSrot(
                    is_numeric($periode) ? (int) $periode : null,
                ),
                'remboursements' => $this->tvaRecettesService->obtenirRemboursements(
                    is_numeric($periode) ? (int) $periode : null,
                ),
            ]);
        });
    }

    #[Route('/rap', name: 'sof_recettes_tva_rap', methods: ['GET'])]
    public function rap(Request $request): JsonResponse
    {
        return $this->run(fn () => new JsonResponse(
            $this->tvaRecettesService->obtenirRap($this->periodeId($request)),
        ));
    }

    #[Route('/tofe', name: 'sof_recettes_tva_tofe', methods: ['GET'])]
    public function tofe(Request $request): JsonResponse
    {
        return $this->run(fn () => new JsonResponse(
            $this->tvaRecettesService->obtenirTofe($this->periodeId($request)),
        ));
    }

    #[Route('/taux-change', name: 'sof_recettes_tva_taux_change', methods: ['GET'])]
    public function tauxChange(Request $request): JsonResponse
    {
        $annee = $request->query->get('exercice_annee');

        return $this->run(fn () => new JsonResponse(
            $this->tvaRecettesService->obtenirTauxChange(
                is_numeric($annee) ? (int) $annee : null,
                $this->periodeId($request),
            ),
        ));
    }

    #[Route('/taux-change', name: 'sof_recettes_tva_taux_change_enregistrer', methods: ['PUT'])]
    #[IsGranted('ROLE_CHEF_SOF')]
    public function enregistrerTauxChange(Request $request): JsonResponse
    {
        return $this->run(function () use ($request) {
            $payload = $this->payload($request);
            $annee = $payload['exercice_annee'] ?? null;
            if (!is_numeric($annee)) {
                throw new DonneesInvalidesException('exercice_annee requis.');
            }
            $taux = $payload['taux'] ?? null;
            if (!\is_array($taux)) {
                throw new DonneesInvalidesException('Liste « taux » requise ([{mois, devise, taux}]).');
            }
            /** @var list<array<string, mixed>> $liste */
            $liste = array_values(array_filter($taux, '\is_array'));

            return new JsonResponse(
                $this->tvaRecettesService->enregistrerTauxChange((int) $annee, $liste),
            );
        });
    }

    private function periodeId(Request $request): ?int
    {
        $periode = $request->query->get('periode_id');

        return $periode !== null && $periode !== '' ? (int) $periode : null;
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
