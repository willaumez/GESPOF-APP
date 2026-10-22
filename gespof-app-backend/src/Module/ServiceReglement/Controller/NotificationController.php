<?php

declare(strict_types=1);

namespace App\Module\ServiceReglement\Controller;

use App\Module\ServiceReglement\Service\FicheDepotServiceInterface;
use App\Shared\Controller\DomainExceptionResponseTrait;
use App\Shared\Entite\Utilisateur;
use App\Shared\Enum\Portail;
use App\Shared\Service\NotificationServiceInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\CurrentUser;
use Symfony\Component\Security\Http\Attribute\IsGranted;

#[Route('/api/v1/sr/notifications')]
#[IsGranted('ROLE_AGENT_SR')]
final class NotificationController extends AbstractController
{
    use DomainExceptionResponseTrait;

    public function __construct(
        private readonly NotificationServiceInterface $notificationService,
        private readonly FicheDepotServiceInterface $ficheDepotService,
    ) {
    }

    #[Route('', name: 'sr_notifications_liste', methods: ['GET'])]
    public function lister(#[CurrentUser] Utilisateur $user): JsonResponse
    {
        return $this->run(function () use ($user) {
            $this->ficheDepotService->assurerRappelAttenteFicheBleue();

            return new JsonResponse(
                $this->notificationService->listerPourUtilisateur(Portail::SR->value, $user),
            );
        });
    }

    #[Route('/lire-toutes', name: 'sr_notifications_lire_toutes', methods: ['PATCH'])]
    public function lireToutes(#[CurrentUser] Utilisateur $user): JsonResponse
    {
        return $this->run(fn () => new JsonResponse(
            $this->notificationService->marquerToutesLues(Portail::SR->value, $user),
        ));
    }

    #[Route('/{id}/lire', name: 'sr_notifications_lire', methods: ['PATCH'], requirements: ['id' => '\d+'])]
    public function lire(int $id, #[CurrentUser] Utilisateur $user): JsonResponse
    {
        return $this->run(fn () => new JsonResponse(
            $this->notificationService->marquerLue($id, Portail::SR->value, $user),
        ));
    }
}
