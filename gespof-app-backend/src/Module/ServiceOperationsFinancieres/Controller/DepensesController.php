<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Controller;

use App\Module\ServiceOperationsFinancieres\Service\DepensesOracleService;
use App\Shared\Controller\DomainExceptionResponseTrait;
use App\Shared\Exception\DonneesInvalidesException;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

#[Route('/api/v1/sof/depenses')]
#[IsGranted('ROLE_AGENT_SOF')]
final class DepensesController extends AbstractController
{
    use DomainExceptionResponseTrait;

    public function __construct(
        private readonly DepensesOracleService $depensesOracleService,
    ) {
    }

    #[Route('/avances/etat', name: 'sof_depenses_avances_etat', methods: ['GET'])]
    public function avancesEtat(Request $request): JsonResponse
    {
        return $this->extraire($request, fn (string $d, string $f): array => $this->depensesOracleService->extraireAvancesEtat($d, $f));
    }

    #[Route('/avances/poste', name: 'sof_depenses_avances_poste', methods: ['GET'])]
    public function avancesPoste(Request $request): JsonResponse
    {
        return $this->extraire($request, fn (string $d, string $f): array => $this->depensesOracleService->extraireAvancesPoste($d, $f));
    }

    #[Route('/etats-liquidation', name: 'sof_depenses_etats_liquidation', methods: ['GET'])]
    public function etatsLiquidation(Request $request): JsonResponse
    {
        return $this->extraire($request, fn (string $d, string $f): array => $this->depensesOracleService->extraireEtatsLiquidation($d, $f));
    }

    #[Route('/reglements', name: 'sof_depenses_reglements', methods: ['GET'])]
    public function reglements(Request $request): JsonResponse
    {
        return $this->extraire($request, fn (string $d, string $f): array => $this->depensesOracleService->extraireReglements($d, $f));
    }

    #[Route('/credits-delegues', name: 'sof_depenses_credits_delegues', methods: ['GET'])]
    public function creditsDelegues(Request $request): JsonResponse
    {
        return $this->extraire($request, fn (string $d, string $f): array => $this->depensesOracleService->extraireCreditsDelegues($d, $f));
    }

    /**
     * @param callable(string, string): array<string, mixed> $extracteur
     */
    private function extraire(Request $request, callable $extracteur): JsonResponse
    {
        set_time_limit(180);

        return $this->run(function () use ($request, $extracteur) {
            [$dateDebut, $dateFin] = $this->exigerPeriode($request);

            return new JsonResponse($extracteur($dateDebut, $dateFin));
        });
    }

    /**
     * @return array{0: string, 1: string}
     */
    private function exigerPeriode(Request $request): array
    {
        $dateDebut = trim($request->query->getString('date_debut'));
        $dateFin = trim($request->query->getString('date_fin'));
        if ($dateDebut === '' || $dateFin === '') {
            throw new DonneesInvalidesException(
                'Les paramètres "date_debut" et "date_fin" sont requis.',
            );
        }

        return [$dateDebut, $dateFin];
    }
}
