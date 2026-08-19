<?php

declare(strict_types=1);

namespace App\Module\ServicePrevision\Controller;

use App\Module\ServicePrevision\Service\Exception\DonneesInvalidesException;
use App\Module\ServicePrevision\Service\FicheBleueModeleServiceInterface;
use App\Module\ServicePrevision\Service\MaquetteExcelGeneratorInterface;
use App\Shared\Controller\DomainExceptionResponseTrait;
use App\Shared\Exception\ApiExceptionInterface;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

#[Route('/api/v1/sp/service-prevision/maquettes')]
#[IsGranted('ROLE_AGENT_SP')]
final class FicheBleueModeleController extends AbstractController
{
    use DomainExceptionResponseTrait;

    public function __construct(
        private readonly FicheBleueModeleServiceInterface $maquetteService,
        private readonly MaquetteExcelGeneratorInterface $excelGenerator,
    ) {
    }

    #[Route('', name: 'sp_maquettes_liste', methods: ['GET'])]
    public function liste(Request $request): JsonResponse
    {
        $recherche = trim((string) $request->query->get('q', ''));

        return $this->run(fn () => new JsonResponse(
            $this->maquetteService->lister($recherche === '' ? null : $recherche),
        ));
    }

    #[Route('/catalogue-sections', name: 'sp_maquettes_catalogue_sections', methods: ['GET'])]
    public function catalogueSections(): JsonResponse
    {
        return $this->run(fn () => new JsonResponse($this->maquetteService->listerCatalogueSections()));
    }

    #[Route('/{id}', name: 'sp_maquettes_detail', methods: ['GET'], requirements: ['id' => '\d+'])]
    public function detail(int $id): JsonResponse
    {
        return $this->run(fn () => new JsonResponse($this->maquetteService->detail($id)));
    }

    /**
     * Rendu Excel de la maquette (colonnes BANCAIRE / PROGRAMMATION), utilise
     * par le bouton "Vue" du tableau des maquettes cote frontend.
     */
    #[Route('/{id}/excel', name: 'sp_maquettes_excel', methods: ['GET'], requirements: ['id' => '\d+'])]
    public function excel(int $id): Response
    {
        // run() est type JsonResponse : la reponse binaire est construite hors
        // du helper, avec la meme traduction des exceptions du domaine.
        try {
            $detail = $this->maquetteService->detail($id)['maquette'];
        } catch (ApiExceptionInterface $e) {
            return new JsonResponse(['message' => $e->getMessage()], $e->getStatusCode());
        }

        $spreadsheet = $this->excelGenerator->generer($detail['nom'], $detail['sections']);

        $reponse = new StreamedResponse(static function () use ($spreadsheet): void {
            (new Xlsx($spreadsheet))->save('php://output');
        });
        $reponse->headers->set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        $reponse->headers->set(
            'Content-Disposition',
            sprintf('attachment; filename="Maquette-Fiche-Bleue-%d.xlsx"', $id),
        );

        return $reponse;
    }

    #[Route('', name: 'sp_maquettes_creer', methods: ['POST'])]
    public function creer(Request $request): JsonResponse
    {
        return $this->run(fn () => new JsonResponse(
            $this->maquetteService->creer($this->payload($request)),
            Response::HTTP_CREATED,
        ));
    }

    #[Route('/{id}', name: 'sp_maquettes_modifier', methods: ['PUT'], requirements: ['id' => '\d+'])]
    public function modifier(int $id, Request $request): JsonResponse
    {
        return $this->run(fn () => new JsonResponse($this->maquetteService->modifier($id, $this->payload($request))));
    }

    #[Route('/{id}', name: 'sp_maquettes_supprimer', methods: ['DELETE'], requirements: ['id' => '\d+'])]
    #[IsGranted('ROLE_CHEF_SP')]
    public function supprimer(int $id): JsonResponse
    {
        return $this->run(function () use ($id) {
            $this->maquetteService->supprimer($id);

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
