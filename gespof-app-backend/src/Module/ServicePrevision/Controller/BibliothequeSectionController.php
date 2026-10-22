<?php

declare(strict_types=1);

namespace App\Module\ServicePrevision\Controller;

use App\Module\ServicePrevision\Service\BibliothequeSectionServiceInterface;
use App\Module\ServicePrevision\Service\Exception\DonneesInvalidesException;
use App\Shared\Controller\DomainExceptionResponseTrait;
use App\Shared\Entite\Utilisateur;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\CurrentUser;
use Symfony\Component\Security\Http\Attribute\IsGranted;

/**
 * Bibliothèque des sections de Fiche Bleue : arbre des sections et
 * sous-sections réutilisables, géré depuis les paramètres du portail SP.
 */
#[Route('/api/v1/sp/service-prevision/bibliotheque-sections')]
#[IsGranted('ROLE_AGENT_SP')]
final class BibliothequeSectionController extends AbstractController
{
    use DomainExceptionResponseTrait;

    public function __construct(
        private readonly BibliothequeSectionServiceInterface $bibliothequeService,
    ) {
    }

    /**
     * Arbre paginé : `q` filtre par libellé (sections et sous-sections),
     * `type` (solde|recette|depense) filtre les racines, `page` / `limite`
     * paginent les sections racines.
     */
    #[Route('', name: 'sp_bibliotheque_sections_liste', methods: ['GET'])]
    public function liste(Request $request): JsonResponse
    {
        $recherche = trim((string) $request->query->get('q', ''));
        $type = trim((string) $request->query->get('type', ''));
        $page = max(1, $request->query->getInt('page', 1));
        $limite = max(1, min(100, $request->query->getInt('limite', 10)));

        return $this->run(fn () => new JsonResponse(
            $this->bibliothequeService->lister(
                $recherche === '' ? null : $recherche,
                $page,
                $limite,
                $type === '' ? null : $type,
            ),
        ));
    }

    /** Une section avec toute son arborescence (dialogs Détail / Modifier). */
    #[Route('/{id}', name: 'sp_bibliotheque_sections_detail', methods: ['GET'], requirements: ['id' => '\d+'])]
    public function detail(int $id): JsonResponse
    {
        return $this->run(fn () => new JsonResponse($this->bibliothequeService->detail($id)));
    }

    #[Route('', name: 'sp_bibliotheque_sections_creer', methods: ['POST'])]
    public function creer(Request $request, #[CurrentUser] Utilisateur $user): JsonResponse
    {
        return $this->run(fn () => new JsonResponse(
            $this->bibliothequeService->creer(
                $this->payload($request),
                $user->getPrenom() . ' ' . $user->getNom(),
            ),
            Response::HTTP_CREATED,
        ));
    }

    #[Route('/{id}', name: 'sp_bibliotheque_sections_modifier', methods: ['PUT'], requirements: ['id' => '\d+'])]
    public function modifier(int $id, Request $request): JsonResponse
    {
        return $this->run(fn () => new JsonResponse(
            $this->bibliothequeService->modifier($id, $this->payload($request)),
        ));
    }

    /**
     * Déplacement d'une section : `direction` ("haut" / "bas") parmi ses
     * voisines, `position` (1..n, glisser-déposer) pour la placer à ce rang
     * de même niveau, et/ou `parent_id` (id ou null pour la racine) pour la
     * rattacher ailleurs. Retourne l'arbre complet mis à jour.
     */
    #[Route('/{id}/deplacer', name: 'sp_bibliotheque_sections_deplacer', methods: ['PUT'], requirements: ['id' => '\d+'])]
    public function deplacer(int $id, Request $request): JsonResponse
    {
        return $this->run(fn () => new JsonResponse(
            $this->bibliothequeService->deplacer($id, $this->payload($request)),
        ));
    }

    #[Route('/{id}', name: 'sp_bibliotheque_sections_supprimer', methods: ['DELETE'], requirements: ['id' => '\d+'])]
    #[IsGranted('ROLE_CHEF_SP')]
    public function supprimer(int $id): JsonResponse
    {
        return $this->run(function () use ($id) {
            $this->bibliothequeService->supprimer($id);

            return new JsonResponse(['ok' => true]);
        });
    }

    private function payload(Request $request): array
    {
        $donnees = json_decode($request->getContent(), true);
        if (!is_array($donnees)) {
            throw new DonneesInvalidesException('Corps de requête JSON invalide.');
        }

        return $donnees;
    }
}
