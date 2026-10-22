<?php

declare(strict_types=1);

namespace App\Module\ServicePrevision\Controller;

use App\Module\ServicePrevision\Service\OperationsBeacServiceInterface;
use App\Shared\Controller\DomainExceptionResponseTrait;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

#[Route('/api/v1/sp/service-prevision/operations-beac')]
#[IsGranted('ROLE_AGENT_SP')]
final class OperationsBeacController extends AbstractController
{
    use DomainExceptionResponseTrait;

    public function __construct(
        private readonly OperationsBeacServiceInterface $operationsBeacService,
    ) {
    }

    #[Route('/dates-ouverture', name: 'sp_operations_beac_dates', methods: ['GET'])]
    public function datesOuverture(): JsonResponse
    {
        return $this->run(fn () => new JsonResponse(
            $this->operationsBeacService->listerDatesOuverture(),
        ));
    }

    #[Route('/recettes', name: 'sp_operations_beac_recettes', methods: ['GET'])]
    public function recettes(Request $request): JsonResponse
    {
        return $this->run(function () use ($request) {
            $date = trim($request->query->getString('date'));
            $recherche = trim($request->query->getString('q'));
            $origine = trim($request->query->getString('origine'));
            $page = max(1, $request->query->getInt('page', 1));
            $limiteBrut = $request->query->get('limite', '15');
            $limite = is_string($limiteBrut) && strtolower($limiteBrut) === 'all'
                ? 'all'
                : max(1, min(500, (int) $limiteBrut));

            return new JsonResponse(
                $this->operationsBeacService->listerRecettes(
                    $date,
                    $recherche !== '' ? $recherche : null,
                    $origine !== '' ? $origine : null,
                    $page,
                    $limite,
                ),
            );
        });
    }
}
