<?php

declare(strict_types=1);

namespace App\Shared\EventListener;

use App\Shared\Entite\Utilisateur;
use App\Shared\Service\AuditActionServiceInterface;
use Doctrine\Persistence\ManagerRegistry;
use Psr\Log\LoggerInterface;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\EventDispatcher\Attribute\AsEventListener;
use Symfony\Component\HttpKernel\Event\TerminateEvent;
use Symfony\Component\HttpKernel\KernelEvents;

/**
 * Enregistre chaque action HTTP mutante (et la connexion) après envoi
 * de la réponse, sans bloquer l'utilisateur. Le mot de passe est masqué
 * dans AuditActionService.
 */
final class AuditActionListener
{
    public function __construct(
        private readonly AuditActionServiceInterface $auditActionService,
        private readonly Security $security,
        private readonly ManagerRegistry $doctrine,
        private readonly LoggerInterface $logger,
    ) {
    }

    #[AsEventListener(event: KernelEvents::TERMINATE)]
    public function onTerminate(TerminateEvent $event): void
    {
        if (!$event->isMainRequest()) {
            return;
        }

        $utilisateur = $this->security->getUser();
        if (!$utilisateur instanceof Utilisateur) {
            $utilisateur = null;
        }

        try {
            $em = $this->doctrine->getManager();
            if (!$em->isOpen()) {
                $this->doctrine->resetManager();
            }
            $this->auditActionService->enregistrerDepuisRequete(
                $event->getRequest(),
                $event->getResponse(),
                $utilisateur,
            );
        } catch (\Throwable $e) {
            $this->logger->warning('Journal d\'actions : enregistrement impossible.', [
                'exception' => $e->getMessage(),
            ]);
        }
    }
}
