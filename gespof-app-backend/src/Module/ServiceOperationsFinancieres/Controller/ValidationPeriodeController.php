<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Controller;

use App\Module\ServiceOperationsFinancieres\Service\ValidationPeriodeService;
use App\Shared\Controller\DomainExceptionResponseTrait;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

/**
 * SPEC §9 / §13 — POST /api/v1/sof/periodes/{id}/valider|rouvrir|publier.
 */
#[Route('/api/v1/sof/periodes')]
#[IsGranted('ROLE_AGENT_SOF')]
final class ValidationPeriodeController extends AbstractController
{
    use DomainExceptionResponseTrait;

    public function __construct(
        private readonly ValidationPeriodeService $validationPeriodeService,
    ) {
    }

    #[Route('/controles', name: 'sof_periodes_controles_courante', methods: ['GET'])]
    public function controlesCourante(Request $request): JsonResponse
    {
        $periode = $request->query->get('periode_id');
        $periodeId = $periode !== null && $periode !== '' ? (int) $periode : null;

        return $this->run(fn () => new JsonResponse(
            $this->validationPeriodeService->controles($periodeId),
        ));
    }

    #[Route('/{id}/controles', name: 'sof_periodes_controles', methods: ['GET'], requirements: ['id' => '\d+'])]
    public function controles(int $id): JsonResponse
    {
        return $this->run(fn () => new JsonResponse(
            $this->validationPeriodeService->controles($id),
        ));
    }

    #[Route('/{id}/valider', name: 'sof_periodes_valider', methods: ['POST'], requirements: ['id' => '\d+'])]
    #[IsGranted('ROLE_CHEF_SOF')]
    public function valider(int $id): JsonResponse
    {
        return $this->run(fn () => new JsonResponse(
            $this->validationPeriodeService->valider($id),
        ));
    }

    #[Route('/{id}/rouvrir', name: 'sof_periodes_rouvrir', methods: ['POST'], requirements: ['id' => '\d+'])]
    #[IsGranted('ROLE_CHEF_SOF')]
    public function rouvrir(int $id, Request $request): JsonResponse
    {
        return $this->run(function () use ($id, $request) {
            $payload = json_decode($request->getContent(), true);
            $payload = \is_array($payload) ? $payload : [];
            $motif = isset($payload['motif']) ? (string) $payload['motif'] : '';

            return new JsonResponse(
                $this->validationPeriodeService->rouvrir($id, $motif),
            );
        });
    }

    #[Route('/{id}/publier', name: 'sof_periodes_publier', methods: ['POST'], requirements: ['id' => '\d+'])]
    #[IsGranted('ROLE_CHEF_SOF')]
    public function publier(int $id, Request $request): JsonResponse
    {
        return $this->run(function () use ($id, $request) {
            $payload = json_decode($request->getContent(), true);
            $payload = \is_array($payload) ? $payload : [];
            $type = isset($payload['type_document']) ? (string) $payload['type_document'] : 'srot';

            return new JsonResponse(
                $this->validationPeriodeService->publier($id, $type),
            );
        });
    }

    #[Route('/{id}/export', name: 'sof_periodes_export', methods: ['GET'], requirements: ['id' => '\d+'])]
    public function export(int $id, Request $request): Response
    {
        return $this->run(function () use ($id, $request) {
            $format = (string) $request->query->get('format', 'html');
            $export = $this->validationPeriodeService->exporter($id, $format);

            return new Response(
                $export['body'],
                Response::HTTP_OK,
                [
                    'Content-Type' => $export['content_type'],
                    'Content-Disposition' => sprintf(
                        'attachment; filename="%s"',
                        $export['filename'],
                    ),
                ],
            );
        });
    }

    #[Route('/publications', name: 'sof_periodes_publications', methods: ['GET'])]
    public function publications(Request $request): JsonResponse
    {
        $exercice = $request->query->get('exercice');
        $periode = $request->query->get('periode_id');

        return $this->run(fn () => new JsonResponse(
            $this->validationPeriodeService->listerPublications(
                $exercice !== null && $exercice !== '' ? (int) $exercice : null,
                $periode !== null && $periode !== '' ? (int) $periode : null,
            ),
        ));
    }
}
