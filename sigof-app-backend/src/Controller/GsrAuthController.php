<?php

declare(strict_types=1);

namespace App\Controller;

use App\Entity\Utilisateur;
use App\Repository\UtilisateurRepository;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\PasswordHasher\Hasher\UserPasswordHasherInterface;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\CurrentUser;

final class GsrAuthController extends AbstractController
{
    public function __construct(
        private readonly UtilisateurRepository $utilisateurRepository,
        private readonly UserPasswordHasherInterface $passwordHasher,
        private readonly JWTTokenManagerInterface $jwtManager,
    ) {
    }

    #[Route('/api/auth/login', name: 'gsr_api_auth_login', methods: ['POST'])]
    public function login(): never
    {
        throw new \LogicException('Intercepted by json_login firewall.');
    }

    #[Route('/api/auth/define-password', name: 'gsr_api_auth_define_password', methods: ['POST'])]
    public function definePassword(Request $request, #[CurrentUser] Utilisateur $user): JsonResponse
    {
        if ($user->getConnection() !== 'first') {
            return new JsonResponse(['message' => 'Ce compte n\'est pas en premiere connexion.'], Response::HTTP_FORBIDDEN);
        }

        $data = json_decode($request->getContent(), true);
        if (!\is_array($data)) {
            return new JsonResponse(['message' => 'JSON attendu.'], Response::HTTP_BAD_REQUEST);
        }

        $newPassword = (string) ($data['newPassword'] ?? '');
        if ($newPassword === '') {
            return new JsonResponse(['message' => 'Le nouveau mot de passe est requis.'], Response::HTTP_BAD_REQUEST);
        }
        if (\strlen($newPassword) < 8) {
            return new JsonResponse(['message' => 'Le nouveau mot de passe doit contenir au moins 8 caracteres.'], Response::HTTP_BAD_REQUEST);
        }

        $user->setMotDePasseHash($this->passwordHasher->hashPassword($user, $newPassword));
        $user->setConnection('connected');
        $this->utilisateurRepository->flush();

        return new JsonResponse([
            'ok' => true,
            'token' => $this->jwtManager->create($user),
            'message' => 'Mot de passe defini avec succes.',
        ]);
    }

    #[Route('/api/auth/verify-password', name: 'gsr_api_auth_verify_password', methods: ['POST'])]
    public function verifyPassword(Request $request, #[CurrentUser] Utilisateur $user): JsonResponse
    {
        $data = json_decode($request->getContent(), true);
        $password = (string) ($data['currentPassword'] ?? '');

        if ($password === '' || !$this->passwordHasher->isPasswordValid($user, $password)) {
            return new JsonResponse(['valid' => false, 'message' => 'Mot de passe incorrect.'], Response::HTTP_UNAUTHORIZED);
        }

        return new JsonResponse(['valid' => true]);
    }

    #[Route('/api/auth/change-password', name: 'gsr_api_auth_change_password', methods: ['POST'])]
    public function changePassword(Request $request, #[CurrentUser] Utilisateur $user): JsonResponse
    {
        $data = json_decode($request->getContent(), true);
        if (!\is_array($data)) {
            return new JsonResponse(['message' => 'JSON attendu.'], Response::HTTP_BAD_REQUEST);
        }

        $currentPassword = (string) ($data['currentPassword'] ?? '');
        $newPassword = (string) ($data['newPassword'] ?? '');

        if ($currentPassword === '' || $newPassword === '') {
            return new JsonResponse(['message' => 'Mot de passe actuel et nouveau mot de passe requis.'], Response::HTTP_BAD_REQUEST);
        }
        if (!$this->passwordHasher->isPasswordValid($user, $currentPassword)) {
            return new JsonResponse(['message' => 'Mot de passe actuel incorrect.'], Response::HTTP_UNAUTHORIZED);
        }
        if (\strlen($newPassword) < 8) {
            return new JsonResponse(['message' => 'Le nouveau mot de passe doit contenir au moins 8 caracteres.'], Response::HTTP_BAD_REQUEST);
        }
        if ($this->passwordHasher->isPasswordValid($user, $newPassword)) {
            return new JsonResponse(['message' => 'Le nouveau mot de passe doit etre different de l\'ancien.'], Response::HTTP_BAD_REQUEST);
        }

        $user->setMotDePasseHash($this->passwordHasher->hashPassword($user, $newPassword));
        $this->utilisateurRepository->flush();

        return new JsonResponse([
            'ok' => true,
            'token' => $this->jwtManager->create($user),
        ]);
    }

    #[Route('/api/auth/me', name: 'gsr_api_auth_me', methods: ['GET'])]
    public function me(#[CurrentUser] Utilisateur $user): JsonResponse
    {
        return new JsonResponse($user->jsonSerialize());
    }

    #[Route('/api/auth/refresh', name: 'gsr_api_auth_refresh', methods: ['POST'])]
    public function refreshToken(): JsonResponse
    {
        $user = $this->getUser();
        if ($user === null) {
            return new JsonResponse([
                'message' => 'Session invalide.',
            ], Response::HTTP_UNAUTHORIZED);
        }

        return new JsonResponse([
            'token' => $this->jwtManager->create($user),
        ]);
    }
}