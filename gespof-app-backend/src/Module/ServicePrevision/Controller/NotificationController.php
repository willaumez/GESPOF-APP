<?php

declare(strict_types=1);

namespace App\Module\ServicePrevision\Controller;

use App\Shared\Controller\DomainExceptionResponseTrait;
use App\Shared\Entite\Utilisateur;
use App\Shared\Enum\Portail;
use App\Shared\Service\NotificationServiceInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\CurrentUser;
use Symfony\Component\Security\Http\Attribute\IsGranted;

#[Route('/api/v1/sp/notifications')]
#[IsGranted('ROLE_AGENT_SP')]
final class NotificationController extends AbstractController
{
    use DomainExceptionResponseTrait;

    public function __construct(
        private readonly NotificationServiceInterface $notificationService,
    ) {
    }

    #[Route('', name: 'sp_notifications_liste', methods: ['GET'])]
    public function lister(#[CurrentUser] Utilisateur $user): JsonResponse
    {
        return $this->run(fn () => new JsonResponse(
            $this->notificationService->listerPourUtilisateur(Portail::SP->value, $user),
        ));
    }

    #[Route('/lire-toutes', name: 'sp_notifications_lire_toutes', methods: ['PATCH'])]
    public function lireToutes(#[CurrentUser] Utilisateur $user): JsonResponse
    {
        return $this->run(fn () => new JsonResponse(
            $this->notificationService->marquerToutesLues(Portail::SP->value, $user),
        ));
    }

    #[Route('/{id}/lire', name: 'sp_notifications_lire', methods: ['PATCH'], requirements: ['id' => '\d+'])]
    public function lire(int $id, #[CurrentUser] Utilisateur $user): JsonResponse
    {
        return $this->run(fn () => new JsonResponse(
            $this->notificationService->marquerLue($id, Portail::SP->value, $user),
        ));
    }
}
