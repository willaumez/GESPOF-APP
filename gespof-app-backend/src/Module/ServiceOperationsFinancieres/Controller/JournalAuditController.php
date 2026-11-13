<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Controller;

use App\Module\ServiceOperationsFinancieres\Service\JournalAuditService;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

#[Route('/api/v1/sof/journal-audit')]
#[IsGranted('ROLE_CHEF_SOF')]
final class JournalAuditController extends AbstractController
{
    public function __construct(
        private readonly JournalAuditService $journalAuditService,
    ) {
    }

    #[Route('', name: 'sof_journal_audit_lister', methods: ['GET'])]
    public function lister(Request $request): JsonResponse
    {
        $utilisateurId = $request->query->get('utilisateur_id');

        return new JsonResponse($this->journalAuditService->lister(
            objetType: $request->query->getString('objet_type') ?: null,
            objetId: $request->query->getString('objet_id') ?: null,
            action: $request->query->getString('action') ?: null,
            utilisateurId: is_numeric($utilisateurId) ? (int) $utilisateurId : null,
            page: max(1, $request->query->getInt('page', 1)),
            limit: max(1, $request->query->getInt('limit', 50)),
        ));
    }
}
