<?php

declare(strict_types=1);

namespace App\Controller\ServiceReglement;

use App\Entity\Utilisateur;
use App\Service\ServiceReglement\UtilisateurServiceInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\CurrentUser;
use Symfony\Component\Security\Http\Attribute\IsGranted;

#[Route('/api/pool-sr/utilisateurs')]
#[IsGranted('ROLE_CHEF_SR')]
final class UtilisateurController extends AbstractController
{
    use DomainExceptionResponseTrait;

    public function __construct(
        private readonly UtilisateurServiceInterface $utilisateurService,
    ) {
    }

    #[Route('', name: 'pool_sr_utilisateur_liste', methods: ['GET'])]
    public function liste(Request $request): JsonResponse
    {
        $search = (string) $request->query->get('search', '');
        $role = $request->query->get('role');
        $statut = $request->query->get('statut');
        $page = (int) $request->query->get('page', 1);
        $limit = (string) $request->query->get('limit', '10');

        return $this->run(fn () => new JsonResponse($this->utilisateurService->lister($search, $role, $statut, $page, $limit)));
    }

    #[Route('/{id}', name: 'pool_sr_utilisateur_detail', methods: ['GET'], requirements: ['id' => '\d+'])]
    public function detail(int $id): JsonResponse
    {
        return $this->run(fn () => new JsonResponse($this->utilisateurService->detail($id)));
    }

    #[Route('', name: 'pool_sr_utilisateur_creer', methods: ['POST'])]
    public function creer(Request $request): JsonResponse
    {
        $data = json_decode($request->getContent(), true);
        if (!\is_array($data)) {
            return new JsonResponse(['message' => 'JSON attendu.'], Response::HTTP_BAD_REQUEST);
        }

        return $this->run(function () use ($data) {
            $utilisateur = $this->utilisateurService->creer($data);

            return new JsonResponse(['ok' => true] + $utilisateur, Response::HTTP_CREATED);
        });
    }

    #[Route('/{id}', name: 'pool_sr_utilisateur_modifier', methods: ['PATCH'], requirements: ['id' => '\d+'])]
    public function modifier(int $id, Request $request): JsonResponse
    {
        $data = json_decode($request->getContent(), true);
        if (!\is_array($data)) {
            return new JsonResponse(['message' => 'JSON attendu.'], Response::HTTP_BAD_REQUEST);
        }

        return $this->run(function () use ($id, $data) {
            $utilisateur = $this->utilisateurService->modifier($id, $data);

            return new JsonResponse(['ok' => true] + $utilisateur);
        });
    }

    #[Route('/{id}/desactiver', name: 'pool_sr_utilisateur_desactiver', methods: ['POST'], requirements: ['id' => '\d+'])]
    public function desactiver(int $id): JsonResponse
    {
        return $this->run(function () use ($id) {
            $this->utilisateurService->desactiver($id);

            return new JsonResponse(['ok' => true]);
        });
    }

    #[Route('/{id}/reactiver', name: 'pool_sr_utilisateur_reactiver', methods: ['POST'], requirements: ['id' => '\d+'])]
    public function reactiver(int $id): JsonResponse
    {
        return $this->run(function () use ($id) {
            $this->utilisateurService->reactiver($id);

            return new JsonResponse(['ok' => true]);
        });
    }

    #[Route('/{id}/reinitialiser-mot-de-passe', name: 'pool_sr_utilisateur_reinitialiser_mot_de_passe', methods: ['POST'], requirements: ['id' => '\d+'])]
    public function reinitialiserMotDePasse(int $id): JsonResponse
    {
        return $this->run(function () use ($id) {
            $resultat = $this->utilisateurService->reinitialiserMotDePasse($id);

            return new JsonResponse(['ok' => true] + $resultat);
        });
    }

    #[Route('/{id}', name: 'pool_sr_utilisateur_supprimer', methods: ['DELETE'], requirements: ['id' => '\d+'])]
    public function supprimer(int $id, #[CurrentUser] Utilisateur $utilisateurConnecte): JsonResponse
    {
        return $this->run(function () use ($id, $utilisateurConnecte) {
            $this->utilisateurService->supprimer($id, $utilisateurConnecte);

            return new JsonResponse(['ok' => true]);
        });
    }
}
