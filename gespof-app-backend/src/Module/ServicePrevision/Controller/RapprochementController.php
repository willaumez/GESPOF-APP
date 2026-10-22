<?php

declare(strict_types=1);

namespace App\Module\ServicePrevision\Controller;

use App\Module\ServicePrevision\Service\Exception\DonneesInvalidesException;
use App\Module\ServicePrevision\Service\RapprochementServiceInterface;
use App\Shared\Controller\DomainExceptionResponseTrait;
use App\Shared\Entite\Utilisateur;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\CurrentUser;
use Symfony\Component\Security\Http\Attribute\IsGranted;

/**
 * Listes validées d'une journée (recettes Oracle, dépenses des fiches de dépôt)
 * et rapprochement avec la Fiche d'exécution.
 */
#[Route(
    '/api/v1/sp/service-prevision/journees-tresorerie/{reference}',
    requirements: ['reference' => 'JT-\d{2}-\d{2}-\d{4}-\d{3}'],
)]
#[IsGranted('ROLE_AGENT_SP')]
final class RapprochementController extends AbstractController
{
    use DomainExceptionResponseTrait;

    public function __construct(
        private readonly RapprochementServiceInterface $rapprochementService,
    ) {
    }

    #[Route('/recettes', name: 'sp_journees_tresorerie_recettes', methods: ['GET'])]
    public function recettes(string $reference): JsonResponse
    {
        return $this->run(fn () => new JsonResponse($this->rapprochementService->recettes($reference)));
    }

    #[Route('/recettes', name: 'sp_journees_tresorerie_valider_recettes', methods: ['PUT'])]
    public function validerRecettes(string $reference, Request $request, #[CurrentUser] Utilisateur $user): JsonResponse
    {
        return $this->run(function () use ($reference, $request, $user) {
            $date = trim((string) ($this->corps($request)['date_ouverture'] ?? ''));
            if ($date === '') {
                throw new DonneesInvalidesException('Le corps doit contenir "date_ouverture" (JJ/MM/AAAA).');
            }

            return new JsonResponse($this->rapprochementService->validerRecettes(
                $reference,
                $date,
                $this->nom($user),
            ));
        });
    }

    #[Route('/depenses', name: 'sp_journees_tresorerie_depenses', methods: ['GET'])]
    public function depenses(string $reference): JsonResponse
    {
        return $this->run(fn () => new JsonResponse($this->rapprochementService->depenses($reference)));
    }

    #[Route('/depenses', name: 'sp_journees_tresorerie_valider_depenses', methods: ['PUT'])]
    public function validerDepenses(string $reference, #[CurrentUser] Utilisateur $user): JsonResponse
    {
        return $this->run(fn () => new JsonResponse(
            $this->rapprochementService->validerDepenses($reference, $this->nom($user)),
        ));
    }

    #[Route('/rapprochements', name: 'sp_journees_tresorerie_rapprocher', methods: ['POST'])]
    public function rapprocher(string $reference, Request $request, #[CurrentUser] Utilisateur $user): JsonResponse
    {
        return $this->run(function () use ($reference, $request, $user) {
            $corps = $this->corps($request);
            $cles = $corps['cles'] ?? null;
            if (!\is_array($cles) || !isset($corps['type'], $corps['section_id'])) {
                throw new DonneesInvalidesException(
                    'Le corps doit contenir "type", "cles" (liste) et "section_id".',
                );
            }

            return new JsonResponse($this->rapprochementService->rapprocher(
                $reference,
                (string) $corps['type'],
                array_values(array_map('strval', $cles)),
                (int) $corps['section_id'],
                $this->nom($user),
            ));
        });
    }

    #[Route('/rapprochements/annulation', name: 'sp_journees_tresorerie_annuler_rapprochement', methods: ['POST'])]
    public function annuler(string $reference, Request $request): JsonResponse
    {
        return $this->run(function () use ($reference, $request) {
            $corps = $this->corps($request);
            if (!isset($corps['type'], $corps['groupe'])) {
                throw new DonneesInvalidesException('Le corps doit contenir "type" et "groupe".');
            }

            return new JsonResponse($this->rapprochementService->annulerRapprochement(
                $reference,
                (string) $corps['type'],
                (string) $corps['groupe'],
            ));
        });
    }

    /** @return array<string, mixed> */
    private function corps(Request $request): array
    {
        $donnees = json_decode($request->getContent(), true);

        return \is_array($donnees) ? $donnees : [];
    }

    private function nom(Utilisateur $user): string
    {
        return $user->getPrenom().' '.$user->getNom();
    }
}
