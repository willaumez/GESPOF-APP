<?php

declare(strict_types=1);

namespace App\Module\ServicePrevision\Controller;

use App\Module\ServicePrevision\Service\JournalJourneeServiceInterface;
use App\Shared\Controller\DomainExceptionResponseTrait;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

/** Audit journalier : qui a fait quoi, et quand, dans une journée de trésorerie. */
#[Route('/api/v1/sp/service-prevision/journees-tresorerie')]
#[IsGranted('ROLE_AGENT_SP')]
final class AuditJournalierController extends AbstractController
{
    use DomainExceptionResponseTrait;

    public function __construct(
        private readonly JournalJourneeServiceInterface $journal,
    ) {
    }

    #[Route(
        '/{reference}/historique',
        name: 'sp_journees_tresorerie_historique',
        methods: ['GET'],
        requirements: ['reference' => 'JT-\d{2}-\d{2}-\d{4}-\d{3}'],
    )]
    public function historique(string $reference): JsonResponse
    {
        return $this->run(fn () => new JsonResponse($this->journal->historique($reference)));
    }
}
