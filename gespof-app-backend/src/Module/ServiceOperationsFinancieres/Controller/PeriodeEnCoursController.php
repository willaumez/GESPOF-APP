<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Controller;

use App\Module\ServiceOperationsFinancieres\Service\PeriodeEnCoursService;
use App\Shared\Controller\DomainExceptionResponseTrait;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

#[Route('/api/v1/sof/periode-en-cours')]
#[IsGranted('ROLE_AGENT_SOF')]
final class PeriodeEnCoursController extends AbstractController
{
    use DomainExceptionResponseTrait;

    public function __construct(
        private readonly PeriodeEnCoursService $periodeEnCoursService,
    ) {
    }

    #[Route('', name: 'sof_periode_en_cours', methods: ['GET'])]
    public function synthetiser(Request $request): JsonResponse
    {
        $periode = $request->query->get('periode_id');
        $periodeId = $periode !== null && $periode !== '' ? (int) $periode : null;

        return $this->run(fn () => new JsonResponse(
            $this->periodeEnCoursService->synthetiser($periodeId),
        ));
    }

    #[Route('/points-attention', name: 'sof_periode_en_cours_point', methods: ['PUT'])]
    public function basculerPoint(Request $request): JsonResponse
    {
        return $this->run(function () use ($request) {
            $donnees = $this->payload($request);
            $periodeId = isset($donnees['periode_id']) ? (int) $donnees['periode_id'] : 0;
            $code = isset($donnees['code']) ? (string) $donnees['code'] : '';
            if ($periodeId < 1 || $code === '') {
                return new JsonResponse(
                    ['message' => 'periode_id et code sont obligatoires.'],
                    Response::HTTP_BAD_REQUEST,
                );
            }
            $coche = array_key_exists('coche', $donnees)
                ? (bool) $donnees['coche']
                : true;

            return new JsonResponse(
                $this->periodeEnCoursService->basculerPointAttention($periodeId, $code, $coche),
            );
        });
    }

    #[Route('/periode-suivante', name: 'sof_periode_en_cours_suivante', methods: ['POST'])]
    #[IsGranted('ROLE_CHEF_SOF')]
    public function ouvrirSuivante(Request $request): JsonResponse
    {
        return $this->run(function () use ($request) {
            $donnees = $this->payload($request);
            $periodeId = isset($donnees['periode_id']) ? (int) $donnees['periode_id'] : 0;
            if ($periodeId < 1) {
                return new JsonResponse(
                    ['message' => 'periode_id est obligatoire.'],
                    Response::HTTP_BAD_REQUEST,
                );
            }

            return new JsonResponse(
                $this->periodeEnCoursService->ouvrirPeriodeSuivante($periodeId),
                Response::HTTP_CREATED,
            );
        });
    }

    /**
     * @return array<string, mixed>
     */
    private function payload(Request $request): array
    {
        $donnees = json_decode($request->getContent(), true);
        if (!is_array($donnees)) {
            $donnees = [];
        }

        return $donnees;
    }
}
