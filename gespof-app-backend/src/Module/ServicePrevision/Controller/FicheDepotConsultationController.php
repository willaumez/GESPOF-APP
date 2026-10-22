<?php

declare(strict_types=1);

namespace App\Module\ServicePrevision\Controller;

use App\Module\ServiceReglement\Enum\StatutFiche;
use App\Module\ServiceReglement\Service\FicheDepotServiceInterface;
use App\Shared\Controller\DomainExceptionResponseTrait;
use App\Shared\Exception\ApiExceptionInterface;
use App\Shared\Entite\Utilisateur;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\ResponseHeaderBag;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\CurrentUser;
use Symfony\Component\Security\Http\Attribute\IsGranted;

/**
 * Consultation SP des Fiches de dépôt (produites par le Service Règlement).
 */
#[Route('/api/v1/sp/service-prevision/fiches-depot')]
#[IsGranted('ROLE_AGENT_SP')]
final class FicheDepotConsultationController extends AbstractController
{
    use DomainExceptionResponseTrait;

    public function __construct(
        private readonly FicheDepotServiceInterface $ficheDepotService,
    ) {
    }

    #[Route('', name: 'sp_fiches_depot_liste', methods: ['GET'])]
    public function liste(Request $request): JsonResponse
    {
        return $this->run(function () use ($request) {
            $statuts = [StatutFiche::ENVOYEE->value, StatutFiche::RECUE->value];
            $journee = $request->query->getString('journee');
            if ($journee !== '') {
                return new JsonResponse($this->ficheDepotService->listerParJourneeTresorerie(
                    $journee,
                    $statuts,
                ));
            }

            $date = $request->query->getString('date');
            if ($date !== '') {
                return new JsonResponse($this->ficheDepotService->listerParDatePresentation(
                    $date,
                    $statuts,
                ));
            }

            // Liste paginée (recherche + filtres) — sans date / journée.
            $page = max(1, (int) $request->query->get('page', 1));
            $limiteBrut = $request->query->get('limite', $request->query->get('limit', '10'));
            $limite = is_string($limiteBrut) ? $limiteBrut : (string) $limiteBrut;
            $q = (string) $request->query->get('q', $request->query->get('search', ''));
            $statut = (string) $request->query->get('statut', '');
            $dateDebut = $request->query->getString('date_debut');
            $dateFin = $request->query->getString('date_fin');

            return new JsonResponse($this->ficheDepotService->fichesPagineesPourSp(
                $page,
                $limite,
                $q,
                $statut,
                $dateDebut !== '' ? $dateDebut : null,
                $dateFin !== '' ? $dateFin : null,
            ));
        });
    }

    #[Route('/{reference}/reception', name: 'sp_fiches_depot_reception', methods: ['POST'])]
    public function reception(string $reference, #[CurrentUser] Utilisateur $user): JsonResponse
    {
        return $this->run(fn () => new JsonResponse(
            $this->ficheDepotService->marquerRecueParSp($reference, $user),
        ));
    }

    #[Route('/{reference}/telecharger', name: 'sp_fiches_depot_telecharger', methods: ['GET'])]
    public function telecharger(string $reference): BinaryFileResponse|JsonResponse
    {
        try {
            $fichier = $this->ficheDepotService->cheminFichier($reference);
        } catch (ApiExceptionInterface $e) {
            return new JsonResponse(['message' => $e->getMessage()], $e->getStatusCode());
        }

        $reponse = new BinaryFileResponse($fichier['chemin']);
        $reponse->headers->set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        $reponse->setContentDisposition(ResponseHeaderBag::DISPOSITION_ATTACHMENT, $fichier['nom']);

        return $reponse;
    }

    #[Route('/{reference}', name: 'sp_fiches_depot_detail', methods: ['GET'])]
    public function detail(string $reference): JsonResponse
    {
        // Le SP ne consulte que les mouvements groupés (pas les lignes SYSTAC).
        return $this->run(fn () => new JsonResponse(
            $this->ficheDepotService->detail($reference, false),
        ));
    }
}
