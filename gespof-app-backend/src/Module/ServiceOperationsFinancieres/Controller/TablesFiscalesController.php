<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Controller;

use App\Module\ServiceOperationsFinancieres\Service\TablesFiscalesService;
use App\Shared\Controller\DomainExceptionResponseTrait;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

#[Route('/api/v1/sof/referentiel/tables-fiscales')]
#[IsGranted('ROLE_AGENT_SOF')]
final class TablesFiscalesController extends AbstractController
{
    use DomainExceptionResponseTrait;

    public function __construct(
        private readonly TablesFiscalesService $tablesFiscalesService,
    ) {
    }

    #[Route('', name: 'sof_tables_fiscales_lister', methods: ['GET'])]
    public function lister(): JsonResponse
    {
        return new JsonResponse($this->tablesFiscalesService->lister());
    }

    #[Route('/comptes', name: 'sof_tables_fiscales_creer_compte', methods: ['POST'])]
    #[IsGranted('ROLE_CHEF_SOF')]
    public function creerCompte(Request $request): JsonResponse
    {
        return $this->run(fn () => new JsonResponse(
            ['compte' => $this->tablesFiscalesService->creerCompte($this->payload($request))],
            Response::HTTP_CREATED,
        ));
    }

    #[Route('/lignes', name: 'sof_tables_fiscales_creer_ligne', methods: ['POST'])]
    #[IsGranted('ROLE_CHEF_SOF')]
    public function creerLigne(Request $request): JsonResponse
    {
        return $this->run(fn () => new JsonResponse(
            ['ligne' => $this->tablesFiscalesService->creerLigne($this->payload($request))],
            Response::HTTP_CREATED,
        ));
    }

    /**
     * @return array<string, mixed>
     */
    private function payload(Request $request): array
    {
        $donnees = json_decode($request->getContent(), true);

        return is_array($donnees) ? $donnees : [];
    }
}
