<?php

declare(strict_types=1);

namespace App\Module\ServicePrevision\Controller;

use App\Module\ServicePrevision\Repository\FicheExecutionRepository;
use App\Module\ServicePrevision\Service\Exception\DonneesInvalidesException;
use App\Module\ServicePrevision\Service\Exception\FicheExecutionIntrouvableException;
use App\Module\ServicePrevision\Service\FicheExecutionExcelGenerator;
use App\Module\ServicePrevision\Service\FicheExecutionServiceInterface;
use App\Shared\Controller\DomainExceptionResponseTrait;
use App\Shared\Entite\Utilisateur;
use App\Shared\Exception\ApiExceptionInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\ResponseHeaderBag;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\CurrentUser;
use Symfony\Component\Security\Http\Attribute\IsGranted;

#[Route('/api/v1/sp/service-prevision')]
#[IsGranted('ROLE_AGENT_SP')]
final class FicheExecutionController extends AbstractController
{
    use DomainExceptionResponseTrait;

    public function __construct(
        private readonly FicheExecutionServiceInterface $ficheExecutionService,
        private readonly FicheExecutionRepository $ficheExecutionRepository,
        private readonly FicheExecutionExcelGenerator $excelGenerator,
    ) {
    }

    /** Cherche la Fiche d'exécution liée à la journée (fiche: null si absente). */
    #[Route(
        '/journees-tresorerie/{reference}/fiche-execution',
        name: 'sp_journees_tresorerie_fiche_execution_get',
        methods: ['GET'],
        requirements: ['reference' => '.+'],
    )]
    public function trouver(string $reference): JsonResponse
    {
        return $this->run(fn () => new JsonResponse(
            $this->ficheExecutionService->trouverPourJournee($reference),
        ));
    }

    /** Crée la Fiche d'exécution si absente (sinon retourne l'existante). */
    #[Route(
        '/journees-tresorerie/{reference}/fiche-execution',
        name: 'sp_journees_tresorerie_fiche_execution_creer',
        methods: ['POST'],
        requirements: ['reference' => '.+'],
    )]
    public function creer(string $reference, #[CurrentUser] Utilisateur $user): JsonResponse
    {
        return $this->run(fn () => new JsonResponse(
            $this->ficheExecutionService->creerPourJournee(
                $reference,
                $user->getPrenom() . ' ' . $user->getNom(),
            ),
        ));
    }

    #[Route('/fiches-execution/{id}', name: 'sp_fiches_execution_detail', methods: ['GET'], requirements: ['id' => '\d+'])]
    public function detail(int $id): JsonResponse
    {
        return $this->run(fn () => new JsonResponse($this->ficheExecutionService->detail($id)));
    }

    #[Route(
        '/fiches-execution/{id}/telecharger',
        name: 'sp_fiches_execution_telecharger',
        methods: ['GET'],
        requirements: ['id' => '\d+'],
    )]
    public function telecharger(int $id): BinaryFileResponse|JsonResponse
    {
        try {
            $fiche = $this->ficheExecutionRepository->find($id);
            if ($fiche === null) {
                throw new FicheExecutionIntrouvableException('Fiche d\'exécution introuvable.');
            }
            $fichier = $this->excelGenerator->generer($fiche);
        } catch (\Throwable $e) {
            $status = $e instanceof FicheExecutionIntrouvableException ? 404 : 500;
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

    #[Route(
        '/fiches-execution/{id}/montants-realise',
        name: 'sp_fiches_execution_montants_realise',
        methods: ['PATCH'],
        requirements: ['id' => '\d+'],
    )]
    public function appliquerMontantsRealise(int $id, Request $request): JsonResponse
    {
        return $this->run(function () use ($id, $request) {
            $donnees = json_decode($request->getContent(), true);
            if (!is_array($donnees)) {
                throw new DonneesInvalidesException('Corps de requête JSON invalide.');
            }

            return new JsonResponse(
                $this->ficheExecutionService->appliquerMontantsRealise($id, $donnees),
            );
        });
    }

    #[Route(
        '/fiches-execution/{id}/sections',
        name: 'sp_fiches_execution_ajouter_section',
        methods: ['POST'],
        requirements: ['id' => '\d+'],
    )]
    public function ajouterSection(int $id, Request $request): JsonResponse
    {
        return $this->run(function () use ($id, $request) {
            $donnees = json_decode($request->getContent(), true);
            if (!is_array($donnees)) {
                throw new DonneesInvalidesException('Corps de requête JSON invalide.');
            }

            return new JsonResponse(
                $this->ficheExecutionService->ajouterSectionNonProgrammee($id, $donnees),
            );
        });
    }

    #[Route(
        '/fiches-execution/{id}/sections/ordre',
        name: 'sp_fiches_execution_reordonner_sections',
        methods: ['PATCH'],
        requirements: ['id' => '\d+'],
    )]
    public function reordonnerSections(int $id, Request $request): JsonResponse
    {
        return $this->run(function () use ($id, $request) {
            $donnees = json_decode($request->getContent(), true);
            if (!is_array($donnees)) {
                throw new DonneesInvalidesException('Corps de requête JSON invalide.');
            }

            return new JsonResponse(
                $this->ficheExecutionService->reordonnerSectionsNonProgrammees($id, $donnees),
            );
        });
    }

    #[Route(
        '/fiches-execution/{id}/sections/{sectionId}',
        name: 'sp_fiches_execution_modifier_section',
        methods: ['PATCH'],
        requirements: ['id' => '\d+', 'sectionId' => '\d+'],
    )]
    public function modifierSection(int $id, int $sectionId, Request $request): JsonResponse
    {
        return $this->run(function () use ($id, $sectionId, $request) {
            $donnees = json_decode($request->getContent(), true);
            if (!is_array($donnees)) {
                throw new DonneesInvalidesException('Corps de requête JSON invalide.');
            }

            return new JsonResponse(
                $this->ficheExecutionService->modifierSectionNonProgrammee($id, $sectionId, $donnees),
            );
        });
    }

    #[Route(
        '/fiches-execution/{id}/sections/{sectionId}',
        name: 'sp_fiches_execution_supprimer_section',
        methods: ['DELETE'],
        requirements: ['id' => '\d+', 'sectionId' => '\d+'],
    )]
    public function supprimerSection(int $id, int $sectionId): JsonResponse
    {
        return $this->run(fn () => new JsonResponse(
            $this->ficheExecutionService->supprimerSectionNonProgrammee($id, $sectionId),
        ));
    }
}
