<?php

declare(strict_types=1);

namespace App\Shared\Security;

use App\Shared\Model\Utilisateur;
use App\Shared\Repository\UtilisateurRepository;
use Symfony\Component\Security\Core\Exception\UnsupportedUserException;
use Symfony\Component\Security\Core\Exception\UserNotFoundException;
use Symfony\Component\Security\Core\User\UserInterface;
use Symfony\Component\Security\Core\User\UserProviderInterface;

final class UtilisateurProvider implements UserProviderInterface
{
    public function __construct(
        private readonly UtilisateurRepository $utilisateurRepository,
    ) {
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

    public function loadUserByIdentifier(string $identifier): UserInterface
    {
        $utilisateur = $this->utilisateurRepository->loadUserByIdentifier($identifier);

        if (!$utilisateur instanceof Utilisateur) {
            throw new UserNotFoundException(sprintf('User "%s" not found.', $identifier));
        }

        return $utilisateur;
    }
}