<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Controller;

use App\Module\ServiceOperationsFinancieres\Service\RapportsService;
use App\Shared\Controller\DomainExceptionResponseTrait;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

#[Route('/api/v1/sof/rapports')]
#[IsGranted('ROLE_AGENT_SOF')]
final class RapportsController extends AbstractController
{
    use DomainExceptionResponseTrait;

    public function __construct(
        private readonly RapportsService $rapportsService,
    ) {
    }

    #[Route('/fiche-srot', name: 'sof_rapports_fiche', methods: ['GET'])]
    public function fiche(Request $request): JsonResponse
    {
        return $this->run(fn () => new JsonResponse(
            $this->rapportsService->ficheSrot($this->periodeId($request)),
        ));
    }

    #[Route('/fiche-srot/commentaires', name: 'sof_rapports_fiche_commentaires', methods: ['PUT'])]
    #[IsGranted('ROLE_AGENT_SOF')]
    public function commentaires(Request $request): JsonResponse
    {
        return $this->run(function () use ($request) {
            $payload = $this->payload($request);
            $periodeId = isset($payload['periode_id'])
                ? (int) $payload['periode_id']
                : (int) ($this->periodeId($request) ?? 0);
            $coms = isset($payload['commentaires']) && \is_array($payload['commentaires'])
                ? $payload['commentaires']
                : [];

            return new JsonResponse(
                $this->rapportsService->enregistrerCommentaires($periodeId, $coms),
            );
        });
    }

    #[Route('/fiche-srot/export', name: 'sof_rapports_fiche_export', methods: ['GET'])]
    public function ficheExport(Request $request): Response
    {
        return $this->run(function () use ($request) {
            $export = $this->rapportsService->exporterFicheHtml($this->periodeId($request));

            return new Response($export['content'], 200, [
                'Content-Type' => $export['content_type'],
                'Content-Disposition' => 'attachment; filename="'.$export['filename'].'"',
            ]);
        });
    }

    #[Route('/tableau-de-bord', name: 'sof_rapports_tdb', methods: ['GET'])]
    public function tdb(Request $request): JsonResponse
    {
        return $this->run(fn () => new JsonResponse(
            $this->rapportsService->tableauDeBord($this->periodeId($request)),
        ));
    }

    #[Route('/tableau-de-bord/hors-srot', name: 'sof_rapports_tdb_hors', methods: ['PUT'])]
    #[IsGranted('ROLE_AGENT_SOF')]
    public function tdbHors(Request $request): JsonResponse
    {
        return $this->run(function () use ($request) {
            $payload = $this->payload($request);
            $exercice = (int) ($payload['exercice'] ?? 0);
            $valeurs = isset($payload['valeurs']) && \is_array($payload['valeurs'])
                ? $payload['valeurs']
                : [];

            return new JsonResponse(
                $this->rapportsService->enregistrerHorsSrot($exercice, $valeurs),
            );
        });
    }

    #[Route('/dgbfip', name: 'sof_rapports_dgbfip', methods: ['GET'])]
    public function dgbfip(Request $request): JsonResponse
    {
        $loi = (string) $request->query->get('loi', 'LFR');

        return $this->run(fn () => new JsonResponse(
            $this->rapportsService->dgbfip($this->periodeId($request), $loi),
        ));
    }

    #[Route('/dgbfip/export', name: 'sof_rapports_dgbfip_export', methods: ['GET'])]
    public function dgbfipExport(Request $request): Response
    {
        return $this->run(function () use ($request) {
            $loi = (string) $request->query->get('loi', 'LFR');
            $export = $this->rapportsService->exporterDgbfipXlsx($this->periodeId($request), $loi);

            return new Response($export['content'], 200, [
                'Content-Type' => $export['content_type'],
                'Content-Disposition' => 'attachment; filename="'.$export['filename'].'"',
            ]);
        });
    }

    private function periodeId(Request $request): ?int
    {
        $periode = $request->query->get('periode_id');

        return $periode !== null && $periode !== '' ? (int) $periode : null;
    }

    /**
     * @return array<string, mixed>
     */
    private function payload(Request $request): array
    {
        $d = json_decode($request->getContent(), true);

        return \is_array($d) ? $d : [];
    }
}
