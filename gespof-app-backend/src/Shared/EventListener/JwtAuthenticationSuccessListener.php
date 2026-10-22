<?php

declare(strict_types=1);

namespace App\Shared\EventListener;

use App\Shared\Entite\Utilisateur;
use App\Shared\Enum\Acces;
use App\Shared\Enum\RoleAcces;
use App\Shared\Service\AuditConnexionServiceInterface;
use Doctrine\ORM\EntityManagerInterface;
use Lexik\Bundle\JWTAuthenticationBundle\Event\JWTCreatedEvent;
use Lexik\Bundle\JWTAuthenticationBundle\Event\JWTDecodedEvent;
use Symfony\Component\EventDispatcher\Attribute\AsEventListener;
use Symfony\Component\HttpFoundation\RequestStack;

final class JwtAuthenticationSuccessListener
{
    public const string ATTR_SESSION_ID = 'gespof_session_id';

    private const string ROUTE_REFRESH = 'gsr_api_auth_refresh';
    private const string ROUTE_LOGIN = 'gsr_api_auth_login';

    public function __construct(
        private readonly EntityManagerInterface $entityManager,
        private readonly RequestStack $requestStack,
        private readonly AuditConnexionServiceInterface $auditConnexionService,
        private readonly int $tokenTtl,
    ) {
    }

    #[AsEventListener(event: 'lexik_jwt_authentication.on_jwt_decoded')]
    public function onJwtDecoded(JWTDecodedEvent $event): void
    {
        $sid = $event->getPayload()['sid'] ?? null;
        if (!\is_string($sid) || $sid === '' || !$this->auditConnexionService->sessionEstActive($sid)) {
            $event->markAsInvalid();

            return;
        }

        $this->requestStack->getCurrentRequest()?->attributes->set(self::ATTR_SESSION_ID, $sid);
    }

    #[AsEventListener(event: 'lexik_jwt_authentication.on_jwt_created')]
    public function onJwtCreated(JWTCreatedEvent $event): void
    {
        $user = $event->getUser();
        if (!$user instanceof Utilisateur) {
            return;
        }

        $requete = $this->requestStack->getCurrentRequest();
        $route = $requete?->attributes->get('_route');
        $estRafraichissement = $route === self::ROUTE_REFRESH;
        $estLogin = $route === self::ROUTE_LOGIN;

        if (!$estRafraichissement) {
            $user->setDerniereConnexion(new \DateTimeImmutable());
            $this->entityManager->persist($user);
            $this->entityManager->flush();
        }

        $payload = $event->getData();
        unset($payload['roles']);
        $payload['nom_complet'] = sprintf('%s %s', $user->getNom(), $user->getPrenom());
        $payload['roles'] = array_map(
            static fn (RoleAcces $role): array => ['valeur' => $role->value, 'libelle' => $role->libelle()],
            $user->getRolesAcces(),
        );
        $payload['acces'] = array_map(
            static fn (Acces $a): array => ['valeur' => $a->value, 'libelle' => $a->libelle()],
            $user->getAcces(),
        );
        $payload['requires_password_change'] = $user->getConnection() === 'first';
        $payload['derniere_connexion'] = $user->getDerniereConnexion()?->format('d/m/Y H:i:s');

        $expiration = $this->expirationJeton();
        $sidExistant = $requete?->attributes->get(self::ATTR_SESSION_ID);
        $sidExistant = \is_string($sidExistant) && $sidExistant !== '' ? $sidExistant : null;

        $session = $this->auditConnexionService->rattacherOuOuvrir(
            $user,
            $sidExistant,
            $expiration,
            $estLogin || $sidExistant === null,
        );
        $payload['sid'] = $session->getUuid();

        $event->setData($payload);
    }

    private function expirationJeton(): \DateTimeImmutable
    {
        $ttl = $this->tokenTtl > 0 ? $this->tokenTtl : 3600;

        return (new \DateTimeImmutable())->modify(sprintf('+%d seconds', $ttl));
    }
}
