<?php

declare(strict_types=1);

namespace App\Module\ServicePrevision\Controller;

use App\Module\ServicePrevision\Repository\FicheBleueRepository;
use App\Module\ServicePrevision\Service\Exception\DonneesInvalidesException;
use App\Module\ServicePrevision\Service\Exception\FicheBleueIntrouvableException;
use App\Module\ServicePrevision\Service\FicheBleueExcelGenerator;
use App\Module\ServicePrevision\Service\FicheBleueServiceInterface;
use App\Shared\Controller\DomainExceptionResponseTrait;
use App\Shared\Entite\Utilisateur;
use App\Shared\Exception\ApiExceptionInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpFoundation\ResponseHeaderBag;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\CurrentUser;
use Symfony\Component\Security\Http\Attribute\IsGranted;

/**
 * Fiches Bleues du portail SP : création depuis la bibliothèque des sections
 * (section Solde obligatoire en en-tête) et consultation.
 */
#[Route('/api/v1/sp/service-prevision/fiches-bleues')]
#[IsGranted('ROLE_AGENT_SP')]
final class FicheBleueController extends AbstractController
{
    use DomainExceptionResponseTrait;

    public function __construct(
        private readonly FicheBleueServiceInterface $ficheBleueService,
        private readonly FicheBleueRepository $ficheBleueRepository,
        private readonly FicheBleueExcelGenerator $excelGenerator,
    ) {
    }

    #[Route('', name: 'sp_fiches_bleues_liste', methods: ['GET'])]
    public function liste(Request $request): JsonResponse
    {
        $page = max(1, $request->query->getInt('page', 1));
        $limiteBrut = $request->query->get('limite', '10');
        $limite = is_string($limiteBrut) && strtolower($limiteBrut) === 'all'
            ? 500
            : max(1, min(500, (int) $limiteBrut));
        $date = $request->query->getString('date');
        $recherche = $request->query->getString('q');
        $statut = $request->query->getString('statut');
        $dateDebut = $request->query->getString('date_debut');
        $dateFin = $request->query->getString('date_fin');

        return $this->run(fn () => new JsonResponse(
            $this->ficheBleueService->lister(
                $page,
                $limite,
                $date !== '' ? $date : null,
                $recherche !== '' ? $recherche : null,
                $statut !== '' ? $statut : null,
                $dateDebut !== '' ? $dateDebut : null,
                $dateFin !== '' ? $dateFin : null,
            ),
        ));
    }

    #[Route('/{id}', name: 'sp_fiches_bleues_detail', methods: ['GET'], requirements: ['id' => '\d+'])]
    public function detail(int $id): JsonResponse
    {
        return $this->run(fn () => new JsonResponse($this->ficheBleueService->detail($id)));
    }

    #[Route('/{id}/telecharger', name: 'sp_fiches_bleues_telecharger', methods: ['GET'], requirements: ['id' => '\d+'])]
    public function telecharger(int $id): BinaryFileResponse|JsonResponse
    {
        try {
            $fiche = $this->ficheBleueRepository->find($id);
            if ($fiche === null) {
                throw new FicheBleueIntrouvableException('Fiche Bleue introuvable.');
            }
            $fichier = $this->excelGenerator->generer($fiche);
        } catch (\Throwable $e) {
            $status = $e instanceof FicheBleueIntrouvableException ? 404 : 500;
            if ($e instanceof ApiExceptionInterface) {
                $status = $e->getStatusCode();
            }

            return new JsonResponse(['message' => $e->getMessage()], $status);
        }

        $reponse = new BinaryFileResponse($fichier['chemin']);
        $reponse->headers->set(
            'Content-Type',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        );
        $reponse->setContentDisposition(ResponseHeaderBag::DISPOSITION_ATTACHMENT, $fichier['nom']);

        return $reponse;
    }

    #[Route('', name: 'sp_fiches_bleues_creer', methods: ['POST'])]
    public function creer(Request $request, #[CurrentUser] Utilisateur $user): JsonResponse
    {
        return $this->run(fn () => new JsonResponse(
            $this->ficheBleueService->creer(
                $this->payload($request),
                $user->getPrenom() . ' ' . $user->getNom(),
            ),
            Response::HTTP_CREATED,
        ));
    }

    #[Route('/{id}', name: 'sp_fiches_bleues_modifier', methods: ['PUT'], requirements: ['id' => '\d+'])]
    public function modifier(int $id, Request $request, #[CurrentUser] Utilisateur $user): JsonResponse
    {
        return $this->run(fn () => new JsonResponse(
            $this->ficheBleueService->modifier(
                $id,
                $this->payload($request),
                $user->getPrenom() . ' ' . $user->getNom(),
            ),
        ));
    }

    #[Route('/{id}/montants-programme', name: 'sp_fiches_bleues_montants_programme', methods: ['PATCH'], requirements: ['id' => '\d+'])]
    public function appliquerMontantsProgramme(int $id, Request $request): JsonResponse
    {
        return $this->run(fn () => new JsonResponse(
            $this->ficheBleueService->appliquerMontantsProgramme($id, $this->payload($request)),
        ));
    }

    #[Route('/{id}/programmation', name: 'sp_fiches_bleues_programmation', methods: ['PATCH'], requirements: ['id' => '\d+'])]
    public function programmerSections(int $id, Request $request): JsonResponse
    {
        return $this->run(fn () => new JsonResponse(
            $this->ficheBleueService->programmerSections($id, $this->payload($request)),
        ));
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
