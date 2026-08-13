<?php

declare(strict_types=1);

namespace App\Module\ServiceReglement\Controller;

use App\Shared\Model\Utilisateur;
use App\Module\ServiceReglement\Service\Exception\ApiExceptionInterface;
use App\Module\ServiceReglement\Service\Exception\AucuneLigneTrouveeException;
use App\Module\ServiceReglement\Service\Exception\DateInvalideException;
use App\Module\ServiceReglement\Service\FicheDepotServiceInterface;
use App\Module\ServiceReglement\Service\ProgressionService;
use Psr\Log\LoggerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpFoundation\ResponseHeaderBag;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\CurrentUser;
use Symfony\Component\Security\Http\Attribute\IsGranted;

#[Route('/api/v1/dr/service-reglement/fiches')]
final class FicheDepotController extends AbstractController
{
    use DomainExceptionResponseTrait;

    public function __construct(
        private readonly FicheDepotServiceInterface $ficheDepensesService,
        private ProgressionService $progressionService,
        private readonly LoggerInterface $logger,
    ) {}

    #[Route('/generer-progress', name: 'pool_sr_fiche_generer_progress', methods: ['POST'])]
    #[IsGranted('ROLE_AGENT_SR')]
    public function genererProgress(Request $request, #[CurrentUser] Utilisateur $user): StreamedResponse
    {
        $data = json_decode($request->getContent(), true);
        $date = \is_array($data) ? ($data['date'] ?? null) : null;

        return $this->progressionService->streamProgression(function($progressCallback) use ($date, $user) {
            try {
                $resultat = $this->ficheDepensesService->genererFicheAvecProgress(
                    $date,
                    $user,
                    $progressCallback
                );

                echo "event: result\ndata: " . json_encode($resultat) . "\n\n";

            } catch (DateInvalideException $e) {
                echo "event: error\ndata: " . json_encode(['message' => $e->getMessage()]) . "\n\n";
            } catch (AucuneLigneTrouveeException $e) {
                echo "event: message\ndata: " . json_encode(['message' => 'Aucune fiche de dépôt pour cette date.']) . "\n\n";
            } catch (\Throwable $e) {
                echo "event: error\ndata: " . json_encode(['message' => 'Erreur: ' . $e->getMessage()]) . "\n\n";
            }
            if (ob_get_level() > 0) {
                ob_flush();
            }
            flush();
        });
    }

    #[Route('', name: 'pool_sr_fiche_liste', methods: ['GET'])]
    #[IsGranted('ROLE_AGENT_SR')]
    public function liste(Request $request): JsonResponse
    {
        $statut = $request->query->get('statut');
        $tri = (string) $request->query->get('tri', 'date');
        $ordre = (string) $request->query->get('ordre', 'DESC');

        return new JsonResponse($this->ficheDepensesService->lister($statut, $tri, $ordre));
    }

    #[Route('/fichesDepenses', name: 'pool_sr_fiche_fichesDepenses', methods: ['GET'])]
    #[IsGranted('ROLE_AGENT_SR')]
    public function fichesDepenses(Request $request): JsonResponse
    {
        $page = (int) $request->query->get('page', 1);
        $limitRaw = (string) $request->query->get('limit', '10');
        $search = (string) $request->query->get('search', '');
        $statut = (string) $request->query->get('statut', '');

        return new JsonResponse($this->ficheDepensesService->fichesPaginees($page, $limitRaw, $search, $statut));
    }

    #[Route('/{reference}', name: 'pool_sr_fiche_detail', methods: ['GET'])]
    #[IsGranted('ROLE_AGENT_SR')]
    public function detail(string $reference): JsonResponse
    {
        return $this->run(fn () => new JsonResponse($this->ficheDepensesService->detail($reference)));
    }

    #[Route('/{reference}/statut', name: 'pool_sr_fiche_changer_statut', methods: ['POST'])]
    #[IsGranted('ROLE_CHEF_SR')]
    public function changerStatut(string $reference, Request $request, #[CurrentUser] Utilisateur $user): JsonResponse
    {
        $data = json_decode($request->getContent(), true);
        $nouveauStatut = \is_array($data) ? ($data['statut'] ?? null) : null;
        $commentaire = \is_array($data) ? ($data['commentaire'] ?? null) : null;

        return $this->run(function () use ($reference, $nouveauStatut, $commentaire, $user) {
            $statut = $this->ficheDepensesService->changerStatut($reference, $nouveauStatut, $commentaire, $user);

            return new JsonResponse(['ok' => true, 'statut' => $statut]);
        });
    }

    #[Route('/{reference}', name: 'pool_sr_fiche_supprimer', methods: ['DELETE'])]
    #[IsGranted('ROLE_CHEF_SR')]
    public function supprimer(string $reference, #[CurrentUser] Utilisateur $user): JsonResponse
    {
        try {
            return $this->run(function () use ($reference, $user) {
                $this->ficheDepensesService->supprimer($reference, $user);

                return new JsonResponse(['ok' => true]);
            });
        } catch (\Throwable $e) {
            $this->logger->error('Échec de la suppression de la fiche de dépôt', [
                'reference' => $reference,
                'exception' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return new JsonResponse(
                ['message' => 'Une erreur est survenue lors de la suppression de la fiche.'],
                Response::HTTP_INTERNAL_SERVER_ERROR,
            );
        }
    }

    #[Route('/{reference}/mouvements/{famille<numeraire|sygma>}', name: 'pool_sr_mouvement_creer', methods: ['POST'])]
    #[IsGranted('ROLE_AGENT_SR')]
    public function creerMouvement(string $reference, string $famille, Request $request, #[CurrentUser] Utilisateur $user): JsonResponse
    {
        $donnees = json_decode($request->getContent(), true);

        return $this->run(function () use ($reference, $famille, $donnees, $user) {
            $ligne = $this->ficheDepensesService->creerMouvement($reference, $famille, \is_array($donnees) ? $donnees : [], $user);

            return new JsonResponse($ligne, Response::HTTP_CREATED);
        });
    }

    #[Route('/{reference}/mouvements/{famille<numeraire|sygma>}/{id<\d+>}', name: 'pool_sr_mouvement_modifier', methods: ['PUT'])]
    #[IsGranted('ROLE_AGENT_SR')]
    public function modifierMouvement(string $reference, string $famille, int $id, Request $request, #[CurrentUser] Utilisateur $user): JsonResponse
    {
        $donnees = json_decode($request->getContent(), true);

        return $this->run(function () use ($reference, $famille, $id, $donnees, $user) {
            $ligne = $this->ficheDepensesService->modifierMouvement($reference, $famille, $id, \is_array($donnees) ? $donnees : [], $user);

            return new JsonResponse($ligne);
        });
    }

    #[Route('/{reference}/mouvements/{famille<numeraire|sygma>}/{id<\d+>}', name: 'pool_sr_mouvement_supprimer', methods: ['DELETE'])]
    #[IsGranted('ROLE_AGENT_SR')]
    public function supprimerMouvement(string $reference, string $famille, int $id, #[CurrentUser] Utilisateur $user): JsonResponse
    {
        return $this->run(function () use ($reference, $famille, $id, $user) {
            $this->ficheDepensesService->supprimerMouvement($reference, $famille, $id, $user);

            return new JsonResponse(['ok' => true]);
        });
    }

    #[Route('/{reference}/apercu', name: 'pool_sr_fiche_apercu', methods: ['GET'])]
    #[IsGranted('ROLE_AGENT_SR')]
    public function apercu(string $reference): BinaryFileResponse|JsonResponse
    {
        return $this->reponseFichier($reference, ResponseHeaderBag::DISPOSITION_INLINE);
    }

    #[Route('/{reference}/telecharger', name: 'pool_sr_fiche_telecharger', methods: ['GET'])]
    #[IsGranted('ROLE_AGENT_SR')]
    public function telecharger(string $reference): BinaryFileResponse|JsonResponse
    {
        return $this->reponseFichier($reference, ResponseHeaderBag::DISPOSITION_ATTACHMENT);
    }

    private function reponseFichier(string $reference, string $disposition): BinaryFileResponse|JsonResponse
    {
        try {
            $fichier = $this->ficheDepensesService->cheminFichier($reference);
        } catch (ApiExceptionInterface $e) {
            return new JsonResponse(['message' => $e->getMessage()], $e->getStatusCode());
        }

        $reponse = new BinaryFileResponse($fichier['chemin']);
        $reponse->headers->set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        $reponse->setContentDisposition($disposition, $fichier['nom']);

        return $reponse;
    }
}
