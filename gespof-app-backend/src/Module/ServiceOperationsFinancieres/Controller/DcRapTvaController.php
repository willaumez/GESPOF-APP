<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Controller;

use App\Module\ServiceOperationsFinancieres\Enum\TypeDcMandat;
use App\Module\ServiceOperationsFinancieres\Service\DcReglementsTvaService;
use App\Shared\Controller\DomainExceptionResponseTrait;
use App\Shared\Exception\DonneesInvalidesException;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\File\UploadedFile;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

/**
 * Imports › Extractions DC › RAP TVA (F5 · XRAM → dc_mandat RAP).
 */
#[Route('/api/v1/sof/imports/dc/rap-tva')]
#[IsGranted('ROLE_AGENT_SOF')]
final class DcRapTvaController extends AbstractController
{
    use DomainExceptionResponseTrait;

    public function __construct(
        private readonly DcReglementsTvaService $dcTvaService,
    ) {
    }

    #[Route('', name: 'sof_dc_rap_tva_etat', methods: ['GET'])]
    public function etat(Request $request): JsonResponse
    {
        $periode = $request->query->get('periode_id');
        $periodeId = $periode !== null && $periode !== '' ? (int) $periode : null;
        $page = max(1, (int) $request->query->get('page', 1));
        $pageSize = max(1, (int) $request->query->get('page_size', 20));

        return $this->run(fn () => new JsonResponse(
            $this->dcTvaService->obtenirEtat($periodeId, $page, $pageSize, TypeDcMandat::RAP),
        ));
    }

    #[Route('/importer-oracle', name: 'sof_dc_rap_tva_importer_oracle', methods: ['POST'])]
    #[IsGranted('ROLE_CHEF_SOF')]
    public function importerOracle(Request $request): JsonResponse
    {
        set_time_limit(180);

        return $this->run(function () use ($request) {
            $payload = $this->payload($request);
            $periode = $payload['periode_id'] ?? null;

            return new JsonResponse(
                $this->dcTvaService->importerOracle(
                    (string) ($payload['date_debut'] ?? ''),
                    (string) ($payload['date_fin'] ?? ''),
                    is_numeric($periode) ? (int) $periode : null,
                    TypeDcMandat::RAP,
                ),
                Response::HTTP_CREATED,
            );
        });
    }

    #[Route('/importer-excel', name: 'sof_dc_rap_tva_importer_excel', methods: ['POST'])]
    #[IsGranted('ROLE_CHEF_SOF')]
    public function importerExcel(Request $request): JsonResponse
    {
        set_time_limit(180);

        return $this->run(function () use ($request) {
            $fichier = $request->files->get('fichier');
            if (!$fichier instanceof UploadedFile) {
                throw new DonneesInvalidesException('Fichier Excel requis (champ « fichier »).');
            }
            $periode = $request->request->get('periode_id');
            $dateDebut = $request->request->getString('date_debut');
            $dateFin = $request->request->getString('date_fin');

            return new JsonResponse(
                $this->dcTvaService->importerExcel(
                    $fichier,
                    is_numeric($periode) ? (int) $periode : null,
                    $dateDebut !== '' ? $dateDebut : null,
                    $dateFin !== '' ? $dateFin : null,
                    TypeDcMandat::RAP,
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
