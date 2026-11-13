<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Controller;

use App\Module\ServiceOperationsFinancieres\Service\ReferentielBudgetaireService;
use App\Shared\Controller\DomainExceptionResponseTrait;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

#[Route('/api/v1/sof/referentiel')]
#[IsGranted('ROLE_AGENT_SOF')]
final class ReferentielController extends AbstractController
{
    use DomainExceptionResponseTrait;

    public function __construct(
        private readonly ReferentielBudgetaireService $referentiel,
    ) {
    }

    #[Route('/rubriques-recettes', name: 'sof_referentiel_rubriques_recettes', methods: ['GET'])]
    public function rubriquesRecettes(): JsonResponse
    {
        return new JsonResponse(['rubriques' => $this->referentiel->arbreRubriquesRecettes()]);
    }

    #[Route('/rubriques-depenses', name: 'sof_referentiel_rubriques_depenses', methods: ['GET'])]
    public function rubriquesDepenses(): JsonResponse
    {
        return new JsonResponse(['rubriques' => $this->referentiel->arbreRubriquesDepenses()]);
    }

    #[Route('/rubriques-recettes', name: 'sof_referentiel_rubrique_recette_creer', methods: ['POST'])]
    #[IsGranted('ROLE_CHEF_SOF')]
    public function creerRubriqueRecette(Request $request): JsonResponse
    {
        return $this->run(fn () => new JsonResponse(
            ['rubrique' => $this->referentiel->creerRubriqueRecette($this->payload($request))],
            Response::HTTP_CREATED,
        ));
    }

    #[Route('/rubriques-depenses', name: 'sof_referentiel_rubrique_depense_creer', methods: ['POST'])]
    #[IsGranted('ROLE_CHEF_SOF')]
    public function creerRubriqueDepense(Request $request): JsonResponse
    {
        return $this->run(fn () => new JsonResponse(
            ['rubrique' => $this->referentiel->creerRubriqueDepense($this->payload($request))],
            Response::HTTP_CREATED,
        ));
    }

    #[Route('/rubriques-recettes/reordonner', name: 'sof_referentiel_rubriques_recettes_reordonner', methods: ['PUT'])]
    #[IsGranted('ROLE_CHEF_SOF')]
    public function reordonnerRubriquesRecettes(Request $request): JsonResponse
    {
        return $this->run(function () use ($request) {
            $donnees = $this->payload($request);
            $parent = $donnees['parent_code'] ?? null;
            $codes = $donnees['codes'] ?? [];
            if (!is_array($codes)) {
                $codes = [];
            }

            return new JsonResponse([
                'rubriques' => $this->referentiel->reordonnerRubriquesRecettes(
                    $parent !== null && $parent !== '' ? (string) $parent : null,
                    array_map(static fn ($c): string => (string) $c, $codes),
                ),
            ]);
        });
    }

    #[Route('/rubriques-depenses/reordonner', name: 'sof_referentiel_rubriques_depenses_reordonner', methods: ['PUT'])]
    #[IsGranted('ROLE_CHEF_SOF')]
    public function reordonnerRubriquesDepenses(Request $request): JsonResponse
    {
        return $this->run(function () use ($request) {
            $donnees = $this->payload($request);
            $parent = $donnees['parent_code'] ?? null;
            $codes = $donnees['codes'] ?? [];
            if (!is_array($codes)) {
                $codes = [];
            }

            return new JsonResponse([
                'rubriques' => $this->referentiel->reordonnerRubriquesDepenses(
                    $parent !== null && $parent !== '' ? (string) $parent : null,
                    array_map(static fn ($c): string => (string) $c, $codes),
                ),
            ]);
        });
    }

    #[Route('/rubriques-recettes/{code}', name: 'sof_referentiel_rubrique_recette_enregistrer', methods: ['PUT'], requirements: ['code' => '[A-Za-z0-9_]+'])]
    #[IsGranted('ROLE_CHEF_SOF')]
    public function enregistrerRubriqueRecette(string $code, Request $request): JsonResponse
    {
        return $this->run(fn () => new JsonResponse([
            'rubrique' => $this->referentiel->enregistrerRubriqueRecette($code, $this->payload($request)),
        ]));
    }

    #[Route('/rubriques-depenses/{code}', name: 'sof_referentiel_rubrique_depense_enregistrer', methods: ['PUT'], requirements: ['code' => '[A-Za-z0-9_]+'])]
    #[IsGranted('ROLE_CHEF_SOF')]
    public function enregistrerRubriqueDepense(string $code, Request $request): JsonResponse
    {
        return $this->run(fn () => new JsonResponse([
            'rubrique' => $this->referentiel->enregistrerRubriqueDepense($code, $this->payload($request)),
        ]));
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
