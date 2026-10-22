<?php

declare(strict_types=1);

namespace App\Module\ServicePrevision\Controller;

use App\Module\ServicePrevision\Service\JourneeTresorerieServiceInterface;
use App\Shared\Controller\DomainExceptionResponseTrait;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;
use App\Module\ServicePrevision\Service\Exception\DonneesInvalidesException;

/**
 * Journées de trésorerie : ouverture (BROUILLON, sans fiches) et consultation.
 */
#[Route('/api/v1/sp/service-prevision/journees-tresorerie')]
#[IsGranted('ROLE_AGENT_SP')]
final class JourneeTresorerieController extends AbstractController
{
    use DomainExceptionResponseTrait;

    public function __construct(
        private readonly JourneeTresorerieServiceInterface $journeeService,
    ) {
    }

    /**
     * Liste paginée des journées de trésorerie.
     *
     * Query : page, limite (int|'all'), q, etat, date, date_debut, date_fin (YYYY-MM-DD).
     * Réponse : { journees, total, page, pages, limite }.
     */
    #[Route('', name: 'sp_journees_tresorerie_liste', methods: ['GET'])]
    public function liste(Request $request): JsonResponse
    {
        $page = max(1, $request->query->getInt('page', 1));
        $limiteBrut = $request->query->get('limite', '15');
        $limite = is_string($limiteBrut) && strtolower($limiteBrut) === 'all'
            ? 500
            : max(1, min(500, (int) $limiteBrut));
        $date = $request->query->getString('date');
        $recherche = $request->query->getString('q');
        $etat = $request->query->getString('etat');
        $dateDebut = $request->query->getString('date_debut');
        $dateFin = $request->query->getString('date_fin');

        return $this->run(fn () => new JsonResponse(
            $this->journeeService->lister(
                $page,
                $limite,
                $date !== '' ? $date : null,
                $recherche !== '' ? $recherche : null,
                $etat !== '' ? $etat : null,
                $dateDebut !== '' ? $dateDebut : null,
                $dateFin !== '' ? $dateFin : null,
            ),
        ));
    }

    #[Route('', name: 'sp_journees_tresorerie_creer', methods: ['POST'])]
    public function creer(): JsonResponse
    {
        return $this->run(fn () => new JsonResponse(
            $this->journeeService->creer(),
            Response::HTTP_CREATED,
        ));
    }

    #[Route('/derniere', name: 'sp_journees_tresorerie_derniere', methods: ['GET'])]
    public function derniere(): JsonResponse
    {
        return $this->run(function () {
            $payload = $this->journeeService->derniere();
            if ($payload === null) {
                return new JsonResponse(['journee' => null]);
            }

            return new JsonResponse($payload);
        });
    }

    #[Route('/du-jour', name: 'sp_journees_tresorerie_du_jour', methods: ['GET'])]
    public function duJour(): JsonResponse
    {
        return $this->run(fn () => new JsonResponse($this->journeeService->duJour()));
    }

    #[Route('/par-date', name: 'sp_journees_tresorerie_par_date', methods: ['GET'])]
    public function parDate(Request $request): JsonResponse
    {
        return $this->run(function () use ($request) {
            $date = trim($request->query->getString('date'));
            if ($date === '') {
                throw new DonneesInvalidesException('Le paramètre "date" est requis (YYYY-MM-DD).');
            }

            return new JsonResponse($this->journeeService->parDate($date));
        });
    }

    #[Route(
        '/{reference}',
        name: 'sp_journees_tresorerie_detail',
        methods: ['GET'],
        requirements: ['reference' => 'JT-\d{2}-\d{2}-\d{4}-\d{3}'],
    )]
    public function detail(string $reference): JsonResponse
    {
        return $this->run(fn () => new JsonResponse($this->journeeService->detail($reference)));
    }

    #[Route(
        '/{reference}/fiche-bleue',
        name: 'sp_journees_tresorerie_lier_fiche_bleue',
        methods: ['PATCH'],
        requirements: ['reference' => 'JT-\d{2}-\d{2}-\d{4}-\d{3}'],
    )]
    public function lierFicheBleue(string $reference, Request $request): JsonResponse
    {
        return $this->run(function () use ($reference, $request) {
            $donnees = json_decode($request->getContent(), true);
            if (!is_array($donnees) || !isset($donnees['fiche_bleue_id'])) {
                throw new DonneesInvalidesException(
                    'Le corps doit contenir "fiche_bleue_id" (entier).',
                );
            }

            return new JsonResponse(
                $this->journeeService->lierFicheBleue($reference, (int) $donnees['fiche_bleue_id']),
            );
        });
    }

    #[Route(
        '/{reference}/cloture',
        name: 'sp_journees_tresorerie_cloturer',
        methods: ['POST'],
        requirements: ['reference' => 'JT-\d{2}-\d{2}-\d{4}-\d{3}'],
    )]
    public function cloturer(string $reference): JsonResponse
    {
        return $this->run(fn () => new JsonResponse(
            $this->journeeService->cloturer($reference),
        ));
    }

    #[Route(
        '/{reference}/reouverture',
        name: 'sp_journees_tresorerie_reouvrir',
        methods: ['POST'],
        requirements: ['reference' => 'JT-\d{2}-\d{2}-\d{4}-\d{3}'],
    )]
    public function reouvrir(string $reference): JsonResponse
    {
        return $this->run(fn () => new JsonResponse(
            $this->journeeService->reouvrir($reference, $this->isGranted('ROLE_CHEF_SP')),
        ));
    }

    #[Route(
        '/{reference}/demander-fiche-depot',
        name: 'sp_journees_tresorerie_demander_fiche_depot',
        methods: ['POST'],
        requirements: ['reference' => 'JT-\d{2}-\d{2}-\d{4}-\d{3}'],
    )]
    public function demanderFicheDepot(string $reference): JsonResponse
    {
        return $this->run(fn () => new JsonResponse(
            $this->journeeService->demanderFicheDepot($reference),
        ));
    }

    #[Route(
        '/{reference}',
        name: 'sp_journees_tresorerie_supprimer',
        methods: ['DELETE'],
        requirements: ['reference' => 'JT-\d{2}-\d{2}-\d{4}-\d{3}'],
    )]
    public function supprimer(string $reference): JsonResponse
    {
        return $this->run(function () use ($reference) {
            $this->journeeService->supprimer($reference);

            return new JsonResponse(null, Response::HTTP_NO_CONTENT);
        });
    }
}
