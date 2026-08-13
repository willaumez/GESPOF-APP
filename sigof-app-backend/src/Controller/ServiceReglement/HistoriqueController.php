<?php

declare(strict_types=1);

namespace App\Controller\ServiceReglement;

use App\Service\ServiceReglement\HistoriqueServiceInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

#[Route('/api/pool-sr/historique')]
#[IsGranted('ROLE_AGENT_SR')]
final class HistoriqueController extends AbstractController
{
    use DomainExceptionResponseTrait;

    public function __construct(
        private readonly HistoriqueServiceInterface $historiqueService,
    ) {
    }

    #[Route('', name: 'pool_sr_historique_liste', methods: ['GET'])]
    public function liste(Request $request): JsonResponse
    {
        $dateDebut = $request->query->get('date_debut');
        $dateFin = $request->query->get('date_fin');
        $utilisateurIdRaw = $request->query->get('utilisateur_id');
        $page = (int) $request->query->get('page', 1);
        $limit = (string) $request->query->get('limit', '20');

        return $this->run(fn () => new JsonResponse($this->historiqueService->lister(
            $dateDebut,
            $dateFin,
            $utilisateurIdRaw !== null && $utilisateurIdRaw !== '' ? (int) $utilisateurIdRaw : null,
            $page,
            $limit,
        )));
    }

    #[Route('/{id}', name: 'pool_sr_historique_supprimer', methods: ['DELETE'], requirements: ['id' => '\d+'])]
    public function supprimer(int $id): JsonResponse
    {
        return $this->run(function () use ($id) {
            $this->historiqueService->supprimer($id);

            return new JsonResponse(['ok' => true]);
        });
    }
}
