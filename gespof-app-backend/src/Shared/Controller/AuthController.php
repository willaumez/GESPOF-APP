<?php

declare(strict_types=1);

namespace App\Shared\Controller;

use App\Shared\Entite\Utilisateur;
use App\Shared\Enum\MotifDeconnexion;
use App\Shared\EventListener\JwtAuthenticationSuccessListener;
use App\Shared\Exception\DonneesInvalidesException;
use App\Shared\Repository\UtilisateurRepository;
use App\Shared\Service\AuditConnexionServiceInterface;
use App\Shared\Service\PhotosDeProfil;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\File\UploadedFile;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\PasswordHasher\Hasher\UserPasswordHasherInterface;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\CurrentUser;

final class AuthController extends AbstractController
{
    public function __construct(
        private readonly UtilisateurRepository $utilisateurRepository,
        private readonly UserPasswordHasherInterface $passwordHasher,
        private readonly JWTTokenManagerInterface $jwtManager,
        private readonly AuditConnexionServiceInterface $auditConnexionService,
        private readonly PhotosDeProfil $photosDeProfil,
    ) {
    }

    #[Route('/api/v1/auth/login', name: 'gsr_api_auth_login', methods: ['POST'])]
    public function login(): never
    {
        throw new \LogicException('Intercepted by json_login firewall.');
    }

    #[Route('/api/v1/auth/define-password', name: 'gsr_api_auth_define_password', methods: ['POST'])]
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

    #[Route('/api/v1/auth/verify-password', name: 'gsr_api_auth_verify_password', methods: ['POST'])]
    public function verifyPassword(Request $request, #[CurrentUser] Utilisateur $user): JsonResponse
    {
        $data = json_decode($request->getContent(), true);
        $password = (string) ($data['currentPassword'] ?? '');

        if ($password === '' || !$this->passwordHasher->isPasswordValid($user, $password)) {
            return new JsonResponse(['valid' => false, 'message' => 'Mot de passe incorrect.'], Response::HTTP_UNAUTHORIZED);
        }

        return new JsonResponse(['valid' => true]);
    }

    #[Route('/api/v1/auth/change-password', name: 'gsr_api_auth_change_password', methods: ['POST'])]
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

    #[Route('/api/v1/auth/me', name: 'gsr_api_auth_me', methods: ['GET'])]
    public function me(#[CurrentUser] Utilisateur $user): JsonResponse
    {
        return new JsonResponse($user->jsonSerialize());
    }

    /** Mise à jour des informations personnelles (prénom, nom, e-mail) — comme Courrier. */
    #[Route('/api/v1/auth/me', name: 'gsr_api_auth_me_update', methods: ['PUT', 'PATCH'])]
    public function updateMe(Request $request, #[CurrentUser] Utilisateur $user): JsonResponse
    {
        $data = json_decode($request->getContent(), true);
        if (!\is_array($data)) {
            return new JsonResponse(['message' => 'JSON attendu.'], Response::HTTP_BAD_REQUEST);
        }

        $prenom = trim((string) ($data['prenom'] ?? $user->getPrenom()));
        $nom = trim((string) ($data['nom'] ?? $user->getNom()));
        $email = trim((string) ($data['email'] ?? $user->getEmail()));

        if ($prenom === '' || $nom === '' || $email === '') {
            return new JsonResponse(
                ['message' => 'Le prénom, le nom et l\'e-mail sont requis.'],
                Response::HTTP_BAD_REQUEST,
            );
        }

        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            return new JsonResponse(['message' => 'Adresse e-mail invalide.'], Response::HTTP_BAD_REQUEST);
        }

        $existant = $this->utilisateurRepository->findOneBy(['email' => $email]);
        if ($existant !== null && $existant->getId() !== $user->getId()) {
            return new JsonResponse(['message' => 'Cet e-mail est déjà utilisé.'], Response::HTTP_CONFLICT);
        }

        $user->setPrenom($prenom);
        $user->setNom($nom);
        $user->setEmail($email);
        $this->utilisateurRepository->flush();

        // Nouveau jeton : l'identifiant JWT est l'e-mail.
        return new JsonResponse(array_merge($user->jsonSerialize(), [
            'token' => $this->jwtManager->create($user),
        ]));
    }

    #[Route('/api/v1/auth/me/photo', name: 'gsr_api_auth_me_photo', methods: ['GET'])]
    public function photo(#[CurrentUser] Utilisateur $user): Response
    {
        if (!$user->aUnePhoto()) {
            return new JsonResponse(['message' => 'Aucune photo de profil.'], Response::HTTP_NOT_FOUND);
        }

        try {
            $photo = $this->photosDeProfil->lire($user);
        } catch (\Throwable) {
            return new JsonResponse(['message' => 'Photo de profil illisible.'], Response::HTTP_NOT_FOUND);
        }

        return new Response($photo['contenu'], Response::HTTP_OK, [
            'Content-Type' => $photo['type'],
            'Cache-Control' => 'no-store',
        ]);
    }

    #[Route('/api/v1/auth/me/photo/bandeau', name: 'gsr_api_auth_me_photo_bandeau', methods: ['GET'])]
    public function photoBandeau(#[CurrentUser] Utilisateur $user): Response
    {
        if (!$user->aUnePhoto()) {
            return new JsonResponse(['message' => 'Aucune photo de profil.'], Response::HTTP_NOT_FOUND);
        }

        try {
            $photo = $this->photosDeProfil->lireBandeau($user);
        } catch (\Throwable) {
            return new JsonResponse(['message' => 'Bandeau de profil illisible.'], Response::HTTP_NOT_FOUND);
        }

        return new Response($photo['contenu'], Response::HTTP_OK, [
            'Content-Type' => $photo['type'],
            'Cache-Control' => 'no-store',
        ]);
    }

    #[Route('/api/v1/auth/me/photo', name: 'gsr_api_auth_me_photo_deposer', methods: ['POST'])]
    public function deposerPhoto(Request $request, #[CurrentUser] Utilisateur $user): JsonResponse
    {
        $fichier = $request->files->get('fichier');
        if (!$fichier instanceof UploadedFile || !$fichier->isValid()) {
            return new JsonResponse(['message' => PhotosDeProfil::MESSAGE_FICHIER], Response::HTTP_BAD_REQUEST);
        }

        $bandeau = $request->files->get('bandeau');
        if ($bandeau instanceof UploadedFile && !$bandeau->isValid()) {
            return new JsonResponse(['message' => PhotosDeProfil::MESSAGE_FICHIER], Response::HTTP_BAD_REQUEST);
        }

        try {
            $this->photosDeProfil->deposer(
                $user,
                $fichier,
                $bandeau instanceof UploadedFile ? $bandeau : null,
            );
        } catch (DonneesInvalidesException $e) {
            return new JsonResponse(['message' => $e->getMessage()], Response::HTTP_BAD_REQUEST);
        }

        return new JsonResponse($user->jsonSerialize());
    }

    #[Route('/api/v1/auth/me/photo/retrait', name: 'gsr_api_auth_me_photo_retrait', methods: ['POST'])]
    public function retirerPhoto(#[CurrentUser] Utilisateur $user): JsonResponse
    {
        $this->photosDeProfil->retirer($user);

        return new JsonResponse($user->jsonSerialize());
    }

    #[Route('/api/v1/auth/logout', name: 'gsr_api_auth_logout', methods: ['POST'])]
    public function logout(Request $request, #[CurrentUser] Utilisateur $user): JsonResponse
    {
        $data = json_decode($request->getContent(), true);
        $motifBrut = \is_array($data) ? (string) ($data['motif'] ?? '') : '';
        $motif = MotifDeconnexion::tryFrom($motifBrut) ?? MotifDeconnexion::DECONNEXION;
        if (\in_array($motif, [MotifDeconnexion::EXPIRATION, MotifDeconnexion::NOUVELLE_CONNEXION], true)) {
            $motif = MotifDeconnexion::DECONNEXION;
        }

        $sid = $request->attributes->get(JwtAuthenticationSuccessListener::ATTR_SESSION_ID);
        $this->auditConnexionService->cloturerSession(
            $user,
            \is_string($sid) ? $sid : null,
            $motif,
        );

        return new JsonResponse(['ok' => true]);
    }

    #[Route('/api/v1/auth/refresh', name: 'gsr_api_auth_refresh', methods: ['POST'])]
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