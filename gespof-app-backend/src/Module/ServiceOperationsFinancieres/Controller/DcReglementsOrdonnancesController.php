<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Controller;

use App\Module\ServiceOperationsFinancieres\Service\DcReglementsOrdonnancesService;
use App\Shared\Controller\DomainExceptionResponseTrait;
use App\Shared\Exception\DonneesInvalidesException;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\File\UploadedFile;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

#[Route('/api/v1/sof/imports/dc/reglements')]
#[IsGranted('ROLE_AGENT_SOF')]
final class DcReglementsOrdonnancesController extends AbstractController
{
    use DomainExceptionResponseTrait;

    public function __construct(
        private readonly DcReglementsOrdonnancesService $dcReglementsOrdonnancesService,
    ) {
    }

    #[Route('', name: 'sof_dc_reglements_ordonnances_etat', methods: ['GET'])]
    public function etat(Request $request): JsonResponse
    {
        $periode = $request->query->get('periode_id');
        $periodeId = $periode !== null && $periode !== '' ? (int) $periode : null;
        $page = max(1, (int) $request->query->get('page', 1));
        $pageSize = max(1, (int) $request->query->get('page_size', 20));

        return $this->run(fn () => new JsonResponse(
            $this->dcReglementsOrdonnancesService->obtenirEtat($periodeId, $page, $pageSize),
        ));
    }

    #[Route('/importer-oracle', name: 'sof_dc_reglements_ordonnances_importer_oracle', methods: ['POST'])]
    #[IsGranted('ROLE_CHEF_SOF')]
    public function importerOracle(Request $request): JsonResponse
    {
        set_time_limit(300);

        return $this->run(function () use ($request) {
            $payload = $this->payload($request);
            $periode = $payload['periode_id'] ?? null;

            return new JsonResponse(
                $this->dcReglementsOrdonnancesService->importerOracle(
                    (string) ($payload['date_debut'] ?? ''),
                    (string) ($payload['date_fin'] ?? ''),
                    is_numeric($periode) ? (int) $periode : null,
                ),
                Response::HTTP_CREATED,
            );
        });
    }

    #[Route('/importer-excel', name: 'sof_dc_reglements_ordonnances_importer_excel', methods: ['POST'])]
    #[IsGranted('ROLE_CHEF_SOF')]
    public function importerExcel(Request $request): JsonResponse
    {
        set_time_limit(300);

        return $this->run(function () use ($request) {
            $fichier = $request->files->get('fichier');
            if (!$fichier instanceof UploadedFile) {
                throw new DonneesInvalidesException('Fichier Excel requis (champ « fichier »).');
            }

            $periode = $request->request->get('periode_id');
            $dateDebut = $request->request->getString('date_debut');
            $dateFin = $request->request->getString('date_fin');

            return new JsonResponse(
                $this->dcReglementsOrdonnancesService->importerExcel(
                    $fichier,
                    is_numeric($periode) ? (int) $periode : null,
                    $dateDebut !== '' ? $dateDebut : null,
                    $dateFin !== '' ? $dateFin : null,
                ),
                Response::HTTP_CREATED,
            );
        });
    }

    /**
     * @return array<string, mixed>
     */
    private function payload(Request $request): array
    {
        $data = json_decode($request->getContent(), true);

        return \is_array($data) ? $data : [];
    }
}
