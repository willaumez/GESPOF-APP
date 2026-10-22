<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Controller;

use App\Module\ServiceOperationsFinancieres\Service\RecettesPetrolieresService;
use App\Shared\Controller\DomainExceptionResponseTrait;
use App\Shared\Exception\DonneesInvalidesException;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

#[Route('/api/v1/sof/recettes-petrolieres')]
#[IsGranted('ROLE_AGENT_SOF')]
final class RecettesPetrolieresController extends AbstractController
{
    use DomainExceptionResponseTrait;

    public function __construct(
        private readonly RecettesPetrolieresService $recettesPetrolieresService,
    ) {
    }

    #[Route('/extraction/op-beac', name: 'sof_recettes_petrolieres_op_beac', methods: ['GET'])]
    public function extractionOpBeac(Request $request): JsonResponse
    {
        set_time_limit(180);

        return $this->run(function () use ($request) {
            $dateDebut = trim($request->query->getString('date_debut'));
            $dateFin = trim($request->query->getString('date_fin'));
            if ($dateDebut === '' || $dateFin === '') {
                throw new DonneesInvalidesException(
                    'Les paramètres "date_debut" et "date_fin" sont requis.',
                );
            }

            return new JsonResponse(
                $this->recettesPetrolieresService->extraireOpBeac($dateDebut, $dateFin),
            );
        });
    }

    #[Route('/extraction/etat-par-compte', name: 'sof_recettes_petrolieres_etat_par_compte', methods: ['GET'])]
    public function extractionEtatParCompte(Request $request): JsonResponse
    {
        set_time_limit(180);

        return $this->run(function () use ($request) {
            $dateDebut = trim($request->query->getString('date_debut'));
            $dateFin = trim($request->query->getString('date_fin'));
            if ($dateDebut === '' || $dateFin === '') {
                throw new DonneesInvalidesException(
                    'Les paramètres "date_debut" et "date_fin" sont requis.',
                );
            }

            return new JsonResponse(
                $this->recettesPetrolieresService->extraireEtatParCompte($dateDebut, $dateFin),
            );
        });
    }

    #[Route('/extraction/etat-par-compte/detail-etax', name: 'sof_recettes_petrolieres_detail_etax', methods: ['GET'])]
    public function extractionDetailEtax(Request $request): JsonResponse
    {
        set_time_limit(120);

        return $this->run(function () use ($request) {
            $refEtax = trim($request->query->getString('ref_etax'));
            if ($refEtax === '') {
                throw new DonneesInvalidesException(
                    'Le paramètre "ref_etax" est requis.',
                );
            }

            return new JsonResponse(
                $this->recettesPetrolieresService->extraireDetailEtax($refEtax),
            );
        });
    }

    #[Route('/extraction/1812-201', name: 'sof_recettes_petrolieres_1812_201', methods: ['GET'])]
    public function extraction1812201(Request $request): JsonResponse
    {
        set_time_limit(180);

        return $this->run(function () use ($request) {
            $dateDebut = trim($request->query->getString('date_debut'));
            $dateFin = trim($request->query->getString('date_fin'));
            if ($dateDebut === '' || $dateFin === '') {
                throw new DonneesInvalidesException(
                    'Les paramètres "date_debut" et "date_fin" sont requis.',
                );
            }

            return new JsonResponse(
                $this->recettesPetrolieresService->extraireCompte1812201($dateDebut, $dateFin),
            );
        });
    }
}
