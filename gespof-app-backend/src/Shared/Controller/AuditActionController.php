<?php

declare(strict_types=1);

namespace App\Shared\Controller;

use App\Shared\Entite\Utilisateur;
use App\Shared\Service\AuditActionServiceInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\CurrentUser;
use Symfony\Component\Security\Http\Attribute\IsGranted;

/**
 * Journal des actions HTTP — transverse.
 *
 * - portee=service : actions du service (chefs / admin).
 * - portee=moi : actions de l'utilisateur connecté (tout agent).
 * - sans portail (page Admin) : toutes les actions.
 */
#[Route('/api/v1/audit-actions')]
#[IsGranted('ROLE_USER')]
final class AuditActionController extends AbstractController
{
    use DomainExceptionResponseTrait;

    public function __construct(
        private readonly AuditActionServiceInterface $auditActionService,
    ) {
    }

    #[Route('', name: 'audit_action_liste', methods: ['GET'])]
    public function liste(Request $request, #[CurrentUser] Utilisateur $utilisateurConnecte): JsonResponse
    {
        $search = (string) $request->query->get('search', '');
        $portee = (string) $request->query->get('portee', 'service');
        $dateDebut = $request->query->get('date_debut');
        $dateFin = $request->query->get('date_fin');
        $methode = $request->query->get('methode');
        $codeHttp = $request->query->get('code_http');
        $utilisateurId = $request->query->get('utilisateur_id');
        $portail = $request->query->get('portail');
        $page = (int) $request->query->get('page', 1);
        $limit = (string) $request->query->get('limit', '20');

        return $this->run(fn () => new JsonResponse(
            $this->auditActionService->lister(
                $utilisateurConnecte,
                $portee,
                $search,
                \is_string($dateDebut) ? $dateDebut : null,
                \is_string($dateFin) ? $dateFin : null,
                \is_string($methode) ? $methode : null,
                is_numeric($codeHttp) ? (int) $codeHttp : null,
                is_numeric($utilisateurId) ? (int) $utilisateurId : null,
                $page,
                $limit,
                \is_string($portail) ? $portail : null,
            ),
        ));
    }
}
