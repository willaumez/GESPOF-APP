<?php

declare(strict_types=1);

namespace App\Shared\Controller;

use App\Shared\Entite\Utilisateur;
use App\Shared\Service\AuditConnexionServiceInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\CurrentUser;
use Symfony\Component\Security\Http\Attribute\IsGranted;

/**
 * Journal des connexions — transverse. La portée (service vs tout) est
 * appliquée dans AuditConnexionService : un chef ne voit que son portail,
 * l'administrateur voit tout (sauf filtre `portail` sur la page d'un service).
 */
#[Route('/api/v1/audit-connexions')]
#[IsGranted('ROLE_USER')]
final class AuditConnexionController extends AbstractController
{
    use DomainExceptionResponseTrait;

    public function __construct(
        private readonly AuditConnexionServiceInterface $auditConnexionService,
    ) {
    }

    #[Route('', name: 'audit_connexion_liste', methods: ['GET'])]
    public function liste(Request $request, #[CurrentUser] Utilisateur $utilisateurConnecte): JsonResponse
    {
        $search = (string) $request->query->get('search', '');
        $statut = $request->query->get('statut');
        $dateDebut = $request->query->get('date_debut');
        $dateFin = $request->query->get('date_fin');
        $utilisateurId = $request->query->get('utilisateur_id');
        $portail = $request->query->get('portail');
        $page = (int) $request->query->get('page', 1);
        $limit = (string) $request->query->get('limit', '15');

        return $this->run(fn () => new JsonResponse(
            $this->auditConnexionService->lister(
                $utilisateurConnecte,
                $search,
                \is_string($statut) ? $statut : null,
                \is_string($dateDebut) ? $dateDebut : null,
                \is_string($dateFin) ? $dateFin : null,
                is_numeric($utilisateurId) ? (int) $utilisateurId : null,
                $page,
                $limit,
                \is_string($portail) ? $portail : null,
            ),
        ));
    }
}
