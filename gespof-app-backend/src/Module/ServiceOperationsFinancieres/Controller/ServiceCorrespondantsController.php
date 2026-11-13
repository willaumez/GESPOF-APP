<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Controller;

use App\Module\ServiceOperationsFinancieres\Service\CorrespondantsService;
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
 * Imports › Services › Correspondants (F10 · DSI).
 */
#[Route('/api/v1/sof/imports/services/correspondants')]
#[IsGranted('ROLE_AGENT_SOF')]
final class ServiceCorrespondantsController extends AbstractController
{
    use DomainExceptionResponseTrait;

    public function __construct(
        private readonly CorrespondantsService $correspondantsService,
    ) {
    }

    #[Route('', name: 'sof_srv_correspondants_etat', methods: ['GET'])]
    public function etat(Request $request): JsonResponse
    {
        $periode = $request->query->get('periode_id');
        $periodeId = $periode !== null && $periode !== '' ? (int) $periode : null;
        $sens = $request->query->getString('sens');

        return $this->run(fn () => new JsonResponse(
            $this->correspondantsService->obtenirEtat($periodeId, $sens !== '' ? $sens : null),
        ));
    }

    #[Route('/importer-excel', name: 'sof_srv_correspondants_importer_excel', methods: ['POST'])]
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
            $sens = $request->request->getString('sens');

            return new JsonResponse(
                $this->correspondantsService->importerExcel(
                    $fichier,
                    is_numeric($periode) ? (int) $periode : null,
                    $sens !== '' ? $sens : null,
                ),
                Response::HTTP_CREATED,
            );
        });
    }
}
