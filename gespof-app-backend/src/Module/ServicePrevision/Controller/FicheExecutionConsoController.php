<?php

declare(strict_types=1);

namespace App\Module\ServicePrevision\Controller;

use App\Module\ServicePrevision\Service\Exception\DonneesInvalidesException;
use App\Module\ServicePrevision\Service\FicheExecutionConsoServiceInterface;
use App\Shared\Controller\DomainExceptionResponseTrait;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

#[Route('/api/v1/sp/service-prevision')]
#[IsGranted('ROLE_AGENT_SP')]
final class FicheExecutionConsoController extends AbstractController
{
    use DomainExceptionResponseTrait;

    public function __construct(
        private readonly FicheExecutionConsoServiceInterface $ficheExecutionConsoService,
    ) {
    }

    #[Route(
        '/fiche-execution-conso',
        name: 'sp_fiche_execution_conso',
        methods: ['GET'],
    )]
    public function matrice(Request $request): JsonResponse
    {
        return $this->run(function () use ($request) {
            $vue = $request->query->get('vue', 'semaine');
            if (!is_string($vue) || trim($vue) === '') {
                $vue = 'semaine';
            }
            $date = $request->query->get('date');
            if ($date !== null && !is_string($date)) {
                throw new DonneesInvalidesException('Le paramètre "date" doit être une chaîne YYYY-MM-DD.');
            }

            return new JsonResponse(
                $this->ficheExecutionConsoService->matrice($vue, $date),
            );
        });
    }
}
