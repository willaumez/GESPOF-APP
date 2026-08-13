<?php

declare(strict_types=1);

namespace App\Shared\Security;

use App\Shared\Model\Utilisateur;
use App\Shared\Repository\UtilisateurRepository;
use Symfony\Component\Security\Core\Exception\UnsupportedUserException;
use Symfony\Component\Security\Core\Exception\UserNotFoundException;
use Symfony\Component\Security\Core\User\UserInterface;
use Symfony\Component\Security\Core\User\UserProviderInterface;

class UserProvider implements UserProviderInterface
{
    public function __construct(
        private readonly UtilisateurRepository $utilisateurRepository,
    ) {
    }

    public function loadUserByIdentifier(string $identifier): UserInterface
    {
        $user = $this->utilisateurRepository->loadUserByIdentifier($identifier);
        if ($user === null) {
            throw new UserNotFoundException(sprintf('Identifiant "%s" introuvable.', $identifier));
        }

        return $user;
    }

    public function refreshUser(UserInterface $user): UserInterface
    {
        if (!$user instanceof Utilisateur) {
            throw new UnsupportedUserException(sprintf('Unsupported user class "%s".', $user::class));
        }

        return $this->utilisateurRepository->refreshUser($user);
    }

    public function supportsClass(string $class): bool
    {
        return Utilisateur::class === $class;
    }
}
