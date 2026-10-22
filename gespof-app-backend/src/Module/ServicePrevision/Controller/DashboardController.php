<?php

declare(strict_types=1);

namespace App\Module\ServicePrevision\Controller;

use App\Module\ServicePrevision\Service\DashboardServiceInterface;
use App\Shared\Controller\DomainExceptionResponseTrait;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

#[Route('/api/v1/sp/service-prevision/dashboard')]
#[IsGranted('ROLE_AGENT_SP')]
final class DashboardController extends AbstractController
{
    use DomainExceptionResponseTrait;

    public function __construct(
        private readonly DashboardServiceInterface $dashboardService,
    ) {
    }

    #[Route('/resume', name: 'sp_dashboard_resume', methods: ['GET'])]
    public function resume(Request $request): JsonResponse
    {
        return $this->run(function () use ($request) {
            $date = trim($request->query->getString('date'));
            $journee = trim($request->query->getString('journee'));

            return new JsonResponse(
                $this->dashboardService->resume(
                    $date === '' ? null : $date,
                    $journee === '' ? null : $journee,
                ),
            );
        });
    }
}
