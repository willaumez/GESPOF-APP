<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Controller;

use App\Module\ServiceOperationsFinancieres\Service\ExecutionN1Service;
use App\Shared\Controller\DomainExceptionResponseTrait;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

#[Route('/api/v1/sof/parametrage/execution-n1')]
#[IsGranted('ROLE_AGENT_SOF')]
final class ExecutionN1Controller extends AbstractController
{
    use DomainExceptionResponseTrait;

    public function __construct(
        private readonly ExecutionN1Service $executionN1Service,
    ) {
    }

    #[Route('/{exerciceCourant}', name: 'sof_execution_n1_obtenir', methods: ['GET'], requirements: ['exerciceCourant' => '\d{4}'])]
    public function obtenir(int $exerciceCourant): JsonResponse
    {
        return new JsonResponse($this->executionN1Service->obtenir($exerciceCourant));
    }

    #[Route('/{exerciceCourant}', name: 'sof_execution_n1_enregistrer', methods: ['PUT'], requirements: ['exerciceCourant' => '\d{4}'])]
    #[IsGranted('ROLE_CHEF_SOF')]
    public function enregistrer(int $exerciceCourant, Request $request): JsonResponse
    {
        return $this->run(fn () => new JsonResponse(
            $this->executionN1Service->enregistrer($exerciceCourant, $this->payload($request)),
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
