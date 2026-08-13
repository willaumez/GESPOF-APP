<?php

declare(strict_types=1);

namespace App\Module\ServiceReglement\Controller;

use App\Module\ServiceReglement\Service\DashboardServiceInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

#[Route('/api/v1/dr/service-reglement/dashboard')]
#[IsGranted('ROLE_AGENT_SR')]
final class DashboardController extends AbstractController
{
    public function __construct(
        private readonly DashboardServiceInterface $dashboardService,
    ) {
    }

    #[Route('/resume', name: 'pool_sr_dashboard_resume', methods: ['GET'])]
    public function resume(): JsonResponse
    {
        return new JsonResponse($this->dashboardService->resume());
    }

    #[Route('/fiches-recentes', name: 'pool_sr_dashboard_fiches_recentes', methods: ['GET'])]
    public function fichesRecentes(): JsonResponse
    {
        return new JsonResponse($this->dashboardService->fichesRecentes());
    }
}
