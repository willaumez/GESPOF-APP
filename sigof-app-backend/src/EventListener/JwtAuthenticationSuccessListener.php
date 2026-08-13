<?php

declare(strict_types=1);

namespace App\EventListener;

use App\Entity\Utilisateur;
use App\Enum\RoleAcces;
use Doctrine\ORM\EntityManagerInterface;
use Lexik\Bundle\JWTAuthenticationBundle\Event\JWTCreatedEvent;
use Symfony\Component\EventDispatcher\Attribute\AsEventListener;
use Symfony\Component\HttpFoundation\RequestStack;

#[AsEventListener(event: 'lexik_jwt_authentication.on_jwt_created')]
final class JwtAuthenticationSuccessListener
{
    private const string ROUTE_REFRESH = 'gsr_api_auth_refresh';

    public function __construct(
        private readonly EntityManagerInterface $entityManager,
        private readonly RequestStack $requestStack,
    ) {
    }

    public function __invoke(JWTCreatedEvent $event): void
    {
        $user = $event->getUser();
        if (!$user instanceof Utilisateur) {
            return;
        }

        $route = $this->requestStack->getCurrentRequest()?->attributes->get('_route');
        if ($route !== self::ROUTE_REFRESH) {
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
        $payload['requires_password_change'] = $user->getConnection() === 'first';
        $payload['derniere_connexion'] = $user->getDerniereConnexion()?->format('d/m/Y H:i:s');

        $event->setData($payload);
    }
}
