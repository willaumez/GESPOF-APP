<?php

declare(strict_types=1);

namespace App\Shared\Controller;

use App\Shared\Entite\Utilisateur;
use App\Shared\Service\UtilisateurServiceInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\CurrentUser;
use Symfony\Component\Security\Http\Attribute\IsGranted;

/**
 * Gestion des utilisateurs — transverse, pas propre a un portail. Chaque
 * action verifie dans le service que l'utilisateur connecte a le droit de
 * gerer le metier concerne (voir UtilisateurService::peutGererMetier()) ;
 * ROLE_USER ici n'est qu'un filtre "doit etre authentifie", pas une
 * autorisation fine.
 */
#[Route('/api/v1/utilisateurs')]
#[IsGranted('ROLE_USER')]
final class UtilisateurController extends AbstractController
{
    use DomainExceptionResponseTrait;

    public function __construct(
        private readonly UtilisateurServiceInterface $utilisateurService,
    ) {
    }

    #[Route('', name: 'utilisateur_liste', methods: ['GET'])]
    public function liste(Request $request, #[CurrentUser] Utilisateur $utilisateurConnecte): JsonResponse
    {
        $search = (string) $request->query->get('search', '');
        $role = $request->query->get('role');
        $statut = $request->query->get('statut');
        $page = (int) $request->query->get('page', 1);
        $limit = (string) $request->query->get('limit', '10');

        return $this->run(fn () => new JsonResponse(
            $this->utilisateurService->lister($utilisateurConnecte, $search, $role, $statut, $page, $limit),
        ));
    }

    #[Route('/{id}', name: 'utilisateur_detail', methods: ['GET'], requirements: ['id' => '\d+'])]
    public function detail(int $id, #[CurrentUser] Utilisateur $utilisateurConnecte): JsonResponse
    {
        return $this->run(fn () => new JsonResponse($this->utilisateurService->detail($utilisateurConnecte, $id)));
    }

    #[Route('', name: 'utilisateur_creer', methods: ['POST'])]
    public function creer(Request $request, #[CurrentUser] Utilisateur $utilisateurConnecte): JsonResponse
    {
        $data = json_decode($request->getContent(), true);
        if (!\is_array($data)) {
            return new JsonResponse(['message' => 'JSON attendu.'], Response::HTTP_BAD_REQUEST);
        }

        return $this->run(function () use ($data, $utilisateurConnecte) {
            $utilisateur = $this->utilisateurService->creer($utilisateurConnecte, $data);

            return new JsonResponse(['ok' => true] + $utilisateur, Response::HTTP_CREATED);
        });
    }

    #[Route('/{id}', name: 'utilisateur_modifier', methods: ['PATCH'], requirements: ['id' => '\d+'])]
    public function modifier(int $id, Request $request, #[CurrentUser] Utilisateur $utilisateurConnecte): JsonResponse
    {
        $data = json_decode($request->getContent(), true);
        if (!\is_array($data)) {
            return new JsonResponse(['message' => 'JSON attendu.'], Response::HTTP_BAD_REQUEST);
        }

        return $this->run(function () use ($id, $data, $utilisateurConnecte) {
            $utilisateur = $this->utilisateurService->modifier($utilisateurConnecte, $id, $data);

            return new JsonResponse(['ok' => true] + $utilisateur);
        });
    }

    #[Route('/{id}/desactiver', name: 'utilisateur_desactiver', methods: ['POST'], requirements: ['id' => '\d+'])]
    public function desactiver(int $id, #[CurrentUser] Utilisateur $utilisateurConnecte): JsonResponse
    {
        return $this->run(function () use ($id, $utilisateurConnecte) {
            $this->utilisateurService->desactiver($utilisateurConnecte, $id);

            return new JsonResponse(['ok' => true]);
        });
    }

    #[Route('/{id}/reactiver', name: 'utilisateur_reactiver', methods: ['POST'], requirements: ['id' => '\d+'])]
    public function reactiver(int $id, #[CurrentUser] Utilisateur $utilisateurConnecte): JsonResponse
    {
        return $this->run(function () use ($id, $utilisateurConnecte) {
            $this->utilisateurService->reactiver($utilisateurConnecte, $id);

            return new JsonResponse(['ok' => true]);
        });
    }

    #[Route('/{id}/reinitialiser-mot-de-passe', name: 'utilisateur_reinitialiser_mot_de_passe', methods: ['POST'], requirements: ['id' => '\d+'])]
    public function reinitialiserMotDePasse(int $id, #[CurrentUser] Utilisateur $utilisateurConnecte): JsonResponse
    {
        return $this->run(function () use ($id, $utilisateurConnecte) {
            $resultat = $this->utilisateurService->reinitialiserMotDePasse($utilisateurConnecte, $id);

            return new JsonResponse(['ok' => true] + $resultat);
        });
    }

    #[Route('/{id}', name: 'utilisateur_supprimer', methods: ['DELETE'], requirements: ['id' => '\d+'])]
    public function supprimer(int $id, #[CurrentUser] Utilisateur $utilisateurConnecte): JsonResponse
    {
        return $this->run(function () use ($id, $utilisateurConnecte) {
            $this->utilisateurService->supprimer($utilisateurConnecte, $id);

            return new JsonResponse(['ok' => true]);
        });
    }
}
