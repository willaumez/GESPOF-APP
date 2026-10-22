<?php

declare(strict_types=1);

namespace App\Module\ServiceReglement\Controller;

use App\Shared\Entite\Utilisateur;
use App\Shared\Controller\DomainExceptionResponseTrait;
use App\Shared\Exception\ApiExceptionInterface;
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

#[Route('/api/v1/sr/service-reglement/fiches')]
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
        $ficheBleueId = \is_array($data) && isset($data['fiche_bleue_id'])
            ? (int) $data['fiche_bleue_id']
            : null;

        return $this->progressionService->streamProgression(function($progressCallback) use ($date, $user, $ficheBleueId) {
            try {
                $resultat = $this->ficheDepensesService->genererFicheAvecProgress(
                    $date,
                    $user,
                    $progressCallback,
                    $ficheBleueId > 0 ? $ficheBleueId : null,
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
        return $this->run(function () use ($request) {
            $page = (int) $request->query->get('page', 1);
            $limitRaw = (string) $request->query->get('limit', '10');
            $search = (string) $request->query->get('search', '');
            $statut = (string) $request->query->get('statut', '');
            $dateDebut = $request->query->getString('date_debut');
            $dateFin = $request->query->getString('date_fin');

            return new JsonResponse($this->ficheDepensesService->fichesPaginees(
                $page,
                $limitRaw,
                $search,
                $statut,
                $dateDebut !== '' ? $dateDebut : null,
                $dateFin !== '' ? $dateFin : null,
            ));
        });
    }

    #[Route('/fiche-recue', name: 'pool_sr_fiche_recue', methods: ['GET'])]
    #[IsGranted('ROLE_AGENT_SR')]
    public function ficheRecue(Request $request): JsonResponse
    {
        return $this->run(function () use ($request) {
            $date = $request->query->getString('date');
            if ($date === '') {
                $date = (new \DateTimeImmutable('today'))->format('Y-m-d');
            }

            return new JsonResponse($this->ficheDepensesService->ficheRecuePourDate($date));
        });
    }

    /** Outil de développement uniquement (404 hors environnement dev). */
    #[Route('/fiche-recue/recentes', name: 'pool_sr_fiches_recues_recentes', methods: ['GET'])]
    #[IsGranted('ROLE_AGENT_SR')]
    public function fichesRecuesRecentes(): JsonResponse
    {
        if ($this->getParameter('kernel.environment') !== 'dev') {
            throw $this->createNotFoundException();
        }

        return $this->run(fn () => new JsonResponse(
            $this->ficheDepensesService->fichesRecuesRecentes(),
        ));
    }

    #[Route('/fiche-recue/{id}', name: 'pool_sr_fiche_recue_detail', methods: ['GET'], requirements: ['id' => '\d+'])]
    #[IsGranted('ROLE_AGENT_SR')]
    public function detailFicheRecue(int $id): JsonResponse
    {
        return $this->run(fn () => new JsonResponse(
            $this->ficheDepensesService->detailFicheRecue($id),
        ));
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

    #[Route('/{reference}/mouvements/{famille<numeraire|sygma>}/{id<\d+>}/rattacher', name: 'pool_sr_mouvement_rattacher', methods: ['POST'])]
    #[IsGranted('ROLE_AGENT_SR')]
    public function rattacherMouvement(string $reference, string $famille, int $id, Request $request, #[CurrentUser] Utilisateur $user): JsonResponse
    {
        $donnees = json_decode($request->getContent(), true);
        $cibleId = \is_array($donnees) ? (int) ($donnees['cible_id'] ?? 0) : 0;

        return $this->run(function () use ($reference, $famille, $id, $cibleId, $user) {
            return new JsonResponse(
                $this->ficheDepensesService->rattacherMouvement($reference, $famille, $id, $cibleId, $user),
            );
        });
    }

    #[Route('/{reference}/mouvements/{famille<numeraire|sygma>}/regrouper', name: 'pool_sr_mouvements_regrouper', methods: ['POST'])]
    #[IsGranted('ROLE_AGENT_SR')]
    public function regrouperMouvements(string $reference, string $famille, Request $request, #[CurrentUser] Utilisateur $user): JsonResponse
    {
        $donnees = json_decode($request->getContent(), true);
        $ids = \is_array($donnees) && \is_array($donnees['ids'] ?? null) ? $donnees['ids'] : [];

        return $this->run(function () use ($reference, $famille, $ids, $user) {
            return new JsonResponse(
                $this->ficheDepensesService->regrouperMouvements($reference, $famille, $ids, $user),
            );
        });
    }

    #[Route('/{reference}/mouvements/{famille<numeraire|sygma>}/supprimer', name: 'pool_sr_mouvements_supprimer', methods: ['POST'])]
    #[IsGranted('ROLE_AGENT_SR')]
    public function supprimerMouvements(string $reference, string $famille, Request $request, #[CurrentUser] Utilisateur $user): JsonResponse
    {
        $donnees = json_decode($request->getContent(), true);
        $ids = \is_array($donnees) && \is_array($donnees['ids'] ?? null) ? $donnees['ids'] : [];

        return $this->run(function () use ($reference, $famille, $ids, $user) {
            return new JsonResponse(
                $this->ficheDepensesService->supprimerMouvements($reference, $famille, $ids, $user),
            );
        });
    }

    #[Route('/{reference}/lignes-systac', name: 'pool_sr_lignes_systac_creer', methods: ['POST'])]
    #[IsGranted('ROLE_AGENT_SR')]
    public function creerLigneSystac(string $reference, Request $request, #[CurrentUser] Utilisateur $user): JsonResponse
    {
        $donnees = json_decode($request->getContent(), true);

        return $this->run(function () use ($reference, $donnees, $user) {
            return new JsonResponse(
                $this->ficheDepensesService->creerLigneSystac($reference, \is_array($donnees) ? $donnees : [], $user),
                Response::HTTP_CREATED,
            );
        });
    }

    #[Route('/{reference}/lignes-systac/supprimer', name: 'pool_sr_lignes_systac_supprimer', methods: ['POST'])]
    #[IsGranted('ROLE_AGENT_SR')]
    public function supprimerLignesSystac(string $reference, Request $request, #[CurrentUser] Utilisateur $user): JsonResponse
    {
        $donnees = json_decode($request->getContent(), true);
        $ids = \is_array($donnees) && \is_array($donnees['ids'] ?? null) ? $donnees['ids'] : [];

        return $this->run(function () use ($reference, $ids, $user) {
            return new JsonResponse(
                $this->ficheDepensesService->supprimerLignesSystac($reference, $ids, $user),
            );
        });
    }

    #[Route('/{reference}/lignes-systac/{id<\d+>}', name: 'pool_sr_ligne_systac_modifier', methods: ['PUT'])]
    #[IsGranted('ROLE_AGENT_SR')]
    public function modifierLigneSystac(string $reference, int $id, Request $request, #[CurrentUser] Utilisateur $user): JsonResponse
    {
        $donnees = json_decode($request->getContent(), true);

        return $this->run(function () use ($reference, $id, $donnees, $user) {
            return new JsonResponse(
                $this->ficheDepensesService->modifierLigneSystac($reference, $id, \is_array($donnees) ? $donnees : [], $user),
            );
        });
    }

    #[Route('/{reference}/lignes-systac/regrouper', name: 'pool_sr_lignes_systac_regrouper', methods: ['POST'])]
    #[IsGranted('ROLE_AGENT_SR')]
    public function regrouperLignesSystac(string $reference, Request $request, #[CurrentUser] Utilisateur $user): JsonResponse
    {
        $donnees = json_decode($request->getContent(), true);
        $ids = \is_array($donnees) && \is_array($donnees['ids'] ?? null) ? $donnees['ids'] : [];

        return $this->run(function () use ($reference, $ids, $user) {
            return new JsonResponse(
                $this->ficheDepensesService->regrouperLignesSystac($reference, $ids, $user),
            );
        });
    }

    #[Route('/{reference}/lignes-systac/{id<\d+>}/deplacer', name: 'pool_sr_ligne_systac_deplacer', methods: ['POST'])]
    #[IsGranted('ROLE_AGENT_SR')]
    public function deplacerLigneSystac(string $reference, int $id, Request $request, #[CurrentUser] Utilisateur $user): JsonResponse
    {
        $donnees = json_decode($request->getContent(), true);
        $idGroupe = \is_array($donnees) ? (int) ($donnees['id_groupe'] ?? 0) : 0;

        return $this->run(function () use ($reference, $id, $idGroupe, $user) {
            return new JsonResponse(
                $this->ficheDepensesService->deplacerLigneSystac($reference, $id, $idGroupe, $user),
            );
        });
    }

    #[Route('/{reference}/mouvements/systac/{id<\d+>}', name: 'pool_sr_groupe_systac_renommer', methods: ['PUT'])]
    #[IsGranted('ROLE_AGENT_SR')]
    public function renommerGroupeSystac(string $reference, int $id, Request $request, #[CurrentUser] Utilisateur $user): JsonResponse
    {
        $donnees = json_decode($request->getContent(), true);
        $designation = \is_array($donnees) && \is_string($donnees['designation'] ?? null)
            ? $donnees['designation']
            : '';

        return $this->run(function () use ($reference, $id, $designation, $user) {
            return new JsonResponse(
                $this->ficheDepensesService->renommerGroupeSystac($reference, $id, $designation, $user),
            );
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
