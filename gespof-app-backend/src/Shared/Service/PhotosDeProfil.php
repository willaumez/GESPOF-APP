<?php

declare(strict_types=1);

namespace App\Shared\Service;

use App\Shared\Entite\Utilisateur;
use App\Shared\Exception\DonneesInvalidesException;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Component\HttpFoundation\File\UploadedFile;

/**
 * Photo de profil : JPEG/PNG ≤ 5 Mo, rangée sous var/avatars/.
 * Pas d'antivirus — contrôles type/taille/getimagesize uniquement.
 */
final class PhotosDeProfil
{
    public const TAILLE_MAX = 5_242_880;

    public const MESSAGE_FICHIER = 'Choisissez une photo JPEG ou PNG de 5 Mo au plus.';

    public function __construct(
        private readonly EntityManagerInterface $em,
        #[Autowire('%kernel.project_dir%')]
        private readonly string $projectDir,
    ) {
    }

    public function deposer(
        Utilisateur $utilisateur,
        UploadedFile $fichier,
        ?UploadedFile $bandeau = null,
    ): void {
        $cheminLocal = $fichier->getPathname();
        $extension = $this->controler($cheminLocal);

        $contenu = @file_get_contents($cheminLocal);
        if (false === $contenu || '' === $contenu) {
            throw new DonneesInvalidesException(self::MESSAGE_FICHIER);
        }

        $empreinte = hash('sha256', $contenu);
        $relatif = $this->cheminRelatif($extension);
        $absolu = $this->absolu($relatif);

        $dossier = \dirname($absolu);
        if (!is_dir($dossier) && !@mkdir($dossier, 0775, true) && !is_dir($dossier)) {
            throw new \RuntimeException('Impossible de créer le dossier des photos de profil.');
        }

        if (false === @file_put_contents($absolu, $contenu)) {
            throw new \RuntimeException('Impossible d\'enregistrer la photo de profil.');
        }

        if ($bandeau instanceof UploadedFile) {
            $this->ecrireBandeau($relatif, $bandeau);
        }

        $utilisateur->definirPhoto($relatif, $empreinte);
        $this->em->flush();
    }

    public function retirer(Utilisateur $utilisateur): void
    {
        if (!$utilisateur->aUnePhoto()) {
            return;
        }
        $chemin = $utilisateur->getPhotoChemin();
        if (null !== $chemin) {
            $bandeau = $this->absolu($this->cheminBandeau($chemin));
            if (is_file($bandeau)) {
                @unlink($bandeau);
            }
        }
        $utilisateur->retirerPhoto();
        $this->em->flush();
    }

    /**
     * @return array{contenu: string, type: string}
     */
    public function lire(Utilisateur $utilisateur): array
    {
        return $this->lireFichier(
            $utilisateur->getPhotoChemin(),
            $utilisateur->getPhotoEmpreinte(),
        );
    }

    /**
     * Bandeau cover : fichier `-bandeau` à côté de l’avatar, sinon fallback avatar.
     *
     * @return array{contenu: string, type: string}
     */
    public function lireBandeau(Utilisateur $utilisateur): array
    {
        $chemin = $utilisateur->getPhotoChemin();
        if (null === $chemin) {
            throw new \LogicException('Utilisateur sans photo de profil.');
        }

        $cheminBandeau = $this->cheminBandeau($chemin);
        $absolu = $this->absolu($cheminBandeau);
        if (is_file($absolu)) {
            $contenu = @file_get_contents($absolu);
            if (false === $contenu) {
                throw new \RuntimeException('Bandeau de profil illisible.');
            }

            return [
                'contenu' => $contenu,
                'type' => str_ends_with(strtolower($cheminBandeau), '.png') ? 'image/png' : 'image/jpeg',
            ];
        }

        return $this->lire($utilisateur);
    }

    /**
     * @return array{contenu: string, type: string}
     */
    private function lireFichier(?string $chemin, ?string $empreinte): array
    {
        if (null === $chemin || null === $empreinte) {
            throw new \LogicException('Utilisateur sans photo de profil.');
        }

        $absolu = $this->absolu($chemin);
        if (!is_file($absolu)) {
            throw new \RuntimeException('Photo de profil introuvable.');
        }

        $contenu = @file_get_contents($absolu);
        if (false === $contenu) {
            throw new \RuntimeException('Photo de profil illisible.');
        }

        if (!hash_equals($empreinte, hash('sha256', $contenu))) {
            throw new \RuntimeException('Empreinte de la photo de profil invalide.');
        }

        return [
            'contenu' => $contenu,
            'type' => str_ends_with(strtolower($chemin), '.png') ? 'image/png' : 'image/jpeg',
        ];
    }

    private function ecrireBandeau(string $cheminAvatar, UploadedFile $bandeau): void
    {
        $cheminLocal = $bandeau->getPathname();
        $this->controler($cheminLocal);

        $contenu = @file_get_contents($cheminLocal);
        if (false === $contenu || '' === $contenu) {
            throw new DonneesInvalidesException(self::MESSAGE_FICHIER);
        }

        $absolu = $this->absolu($this->cheminBandeau($cheminAvatar));
        $dossier = \dirname($absolu);
        if (!is_dir($dossier) && !@mkdir($dossier, 0775, true) && !is_dir($dossier)) {
            throw new \RuntimeException('Impossible de créer le dossier des photos de profil.');
        }

        if (false === @file_put_contents($absolu, $contenu)) {
            throw new \RuntimeException('Impossible d\'enregistrer le bandeau de profil.');
        }
    }

    /** `avatars/2026/03/abc.jpg` → `avatars/2026/03/abc-bandeau.jpg` */
    private function cheminBandeau(string $cheminAvatar): string
    {
        $remplace = preg_replace('/(\.[^.]+)$/', '-bandeau$1', $cheminAvatar);

        return \is_string($remplace) ? $remplace : $cheminAvatar.'-bandeau';
    }

    private function controler(string $fichier): string
    {
        $taille = is_file($fichier) ? filesize($fichier) : false;
        if (false === $taille || 0 === $taille || $taille > self::TAILLE_MAX) {
            throw new DonneesInvalidesException(self::MESSAGE_FICHIER);
        }

        $info = @getimagesize($fichier);
        if (false === $info || !\in_array($info[2], [\IMAGETYPE_JPEG, \IMAGETYPE_PNG], true)) {
            throw new DonneesInvalidesException('Choisissez une photo JPEG ou PNG.');
        }

        return \IMAGETYPE_PNG === $info[2] ? 'png' : 'jpg';
    }

    private function cheminRelatif(string $extension): string
    {
        $now = new \DateTimeImmutable();

        return sprintf(
            'avatars/%s/%s/%s.%s',
            $now->format('Y'),
            $now->format('m'),
            bin2hex(random_bytes(16)),
            $extension,
        );
    }

    private function absolu(string $relatif): string
    {
        $normalise = str_replace(['\\', '..'], ['/', ''], $relatif);

        return $this->projectDir.'/var/'.$normalise;
    }
}
