<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Controller;

use App\Module\ServiceOperationsFinancieres\Service\TvaOracleService;
use App\Shared\Controller\DomainExceptionResponseTrait;
use App\Shared\Exception\DonneesInvalidesException;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

#[Route('/api/v1/sof/tva')]
#[IsGranted('ROLE_AGENT_SOF')]
final class TvaController extends AbstractController
{
    use DomainExceptionResponseTrait;

    public function __construct(
        private readonly TvaOracleService $tvaOracleService,
    ) {
    }

    #[Route('/rap', name: 'sof_tva_rap', methods: ['GET'])]
    public function rap(Request $request): JsonResponse
    {
        return $this->extraire($request, fn (string $d, string $f): array => $this->tvaOracleService->extraireRap($d, $f));
    }

    #[Route('/remboursements-dc', name: 'sof_tva_remboursements_dc', methods: ['GET'])]
    public function remboursementsDc(Request $request): JsonResponse
    {
        return $this->extraire($request, fn (string $d, string $f): array => $this->tvaOracleService->extraireRemboursementsDc($d, $f));
    }

    #[Route('/remboursements-ig', name: 'sof_tva_remboursements_ig', methods: ['GET'])]
    public function remboursementsIg(Request $request): JsonResponse
    {
        return $this->extraire($request, fn (string $d, string $f): array => $this->tvaOracleService->extraireRemboursementsIg($d, $f));
    }

    /**
     * @param callable(string, string): array<string, mixed> $extracteur
     */
    private function extraire(Request $request, callable $extracteur): JsonResponse
    {
        set_time_limit(180);

        return $this->run(function () use ($request, $extracteur) {
            $dateDebut = trim($request->query->getString('date_debut'));
            $dateFin = trim($request->query->getString('date_fin'));
            if ($dateDebut === '' || $dateFin === '') {
                throw new DonneesInvalidesException(
                    'Les paramètres "date_debut" et "date_fin" sont requis.',
                );
            }

            return new JsonResponse($extracteur($dateDebut, $dateFin));
        });
    }
}
