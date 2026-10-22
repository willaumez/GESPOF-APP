<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Controller;

use App\Module\ServiceOperationsFinancieres\Service\RecettesDouanieresService;
use App\Shared\Controller\DomainExceptionResponseTrait;
use App\Shared\Exception\DonneesInvalidesException;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

#[Route('/api/v1/sof/recettes-douanieres')]
#[IsGranted('ROLE_AGENT_SOF')]
final class RecettesDouanieresController extends AbstractController
{
    use DomainExceptionResponseTrait;

    public function __construct(
        private readonly RecettesDouanieresService $recettesDouanieresService,
    ) {
    }

    #[Route('/comptes', name: 'sof_recettes_douanieres_comptes', methods: ['GET'])]
    public function comptes(): JsonResponse
    {
        return $this->run(fn () => new JsonResponse([
            'comptes' => $this->recettesDouanieresService->listerComptes(),
        ]));
    }

    #[Route('/extraction/rusid', name: 'sof_recettes_douanieres_extraction_rusid', methods: ['GET'])]
    public function extractionRusid(Request $request): JsonResponse
    {
        set_time_limit(300);

        return $this->run(function () use ($request) {
            $dateDebut = trim($request->query->getString('date_debut'));
            $dateFin = trim($request->query->getString('date_fin'));
            if ($dateDebut === '' || $dateFin === '') {
                throw new DonneesInvalidesException(
                    'Les paramètres "date_debut" et "date_fin" sont requis.',
                );
            }

            return new JsonResponse(
                $this->recettesDouanieresService->extraireRusid($dateDebut, $dateFin),
            );
        });
    }

    #[Route('/extraction/lot', name: 'sof_recettes_douanieres_extraction_lot', methods: ['GET'])]
    public function extractionLot(Request $request): JsonResponse
    {
        set_time_limit(300);

        return $this->run(function () use ($request) {
            $dateDebut = trim($request->query->getString('date_debut'));
            $dateFin = trim($request->query->getString('date_fin'));
            if ($dateDebut === '' || $dateFin === '') {
                throw new DonneesInvalidesException(
                    'Les paramètres "date_debut" et "date_fin" sont requis.',
                );
            }

            return new JsonResponse(
                $this->recettesDouanieresService->extraireLot($dateDebut, $dateFin),
            );
        });
    }

    #[Route('/extraction', name: 'sof_recettes_douanieres_extraction', methods: ['GET'])]
    public function extraction(Request $request): JsonResponse
    {
        set_time_limit(180);

        return $this->run(function () use ($request) {
            $dateDebut = trim($request->query->getString('date_debut'));
            $dateFin = trim($request->query->getString('date_fin'));
            $compte = trim($request->query->getString('compte'));
            if ($dateDebut === '' || $dateFin === '' || $compte === '') {
                throw new DonneesInvalidesException(
                    'Les paramètres "date_debut", "date_fin" et "compte" sont requis.',
                );
            }

            return new JsonResponse(
                $this->recettesDouanieresService->extraireCompte($dateDebut, $dateFin, $compte),
            );
        });
    }
}
