<?php

declare(strict_types=1);

namespace App\Shared\Service;

use App\Shared\Entite\Notification;
use App\Shared\Entite\Utilisateur;
use App\Shared\Exception\NotificationIntrouvableException;
use App\Shared\Repository\NotificationRepository;

class NotificationService implements NotificationServiceInterface
{
    public function __construct(
        private readonly NotificationRepository $repository,
    ) {
    }

    public function listerPourUtilisateur(string $portail, Utilisateur $utilisateur): array
    {
        $notifications = $this->repository->listerPourPortail($portail);
        $ids = array_values(array_filter(array_map(
            static fn (Notification $n): ?int => $n->getId(),
            $notifications,
        )));
        $lues = array_flip($this->repository->idsLuesPar($utilisateur, $ids));

        return [
            'non_lues' => $this->repository->compterNonLues($portail, $utilisateur),
            'notifications' => array_map(
                function (Notification $n) use ($lues): array {
                    $id = $n->getId() ?? 0;

                    return $this->serialiser($n, isset($lues[$id]));
                },
                $notifications,
            ),
        ];
    }

    public function marquerLue(int $id, string $portail, Utilisateur $utilisateur): array
    {
        $notification = $this->trouverDuPortail($id, $portail);
        $this->repository->marquerLue($notification, $utilisateur);

        return $this->listerPourUtilisateur($portail, $utilisateur);
    }

    public function marquerToutesLues(string $portail, Utilisateur $utilisateur): array
    {
        $this->repository->marquerToutesLues($portail, $utilisateur);

        return $this->listerPourUtilisateur($portail, $utilisateur);
    }

    public function creer(
        string $portail,
        string $type,
        string $titre,
        string $message,
        ?string $cibleType = null,
        ?string $cibleReference = null,
        ?string $lien = null,
        ?array $donnees = null,
        bool $flush = false,
    ): void {
        $notification = new Notification($portail, $type, $titre, $message);
        $notification->setCibleType($cibleType);
        $notification->setCibleReference($cibleReference);
        $notification->setLien($lien);
        $notification->setDonnees($donnees);

        $this->repository->save($notification, $flush);
    }

    public function existePourCible(
        string $portail,
        string $type,
        string $cibleType,
        string $cibleReference,
    ): bool {
        return $this->repository->existePourCible($portail, $type, $cibleType, $cibleReference);
    }

    private function trouverDuPortail(int $id, string $portail): Notification
    {
        $notification = $this->repository->find($id);
        if ($notification === null || $notification->getPortail() !== $portail) {
            throw new NotificationIntrouvableException('Notification introuvable.');
        }

        return $notification;
    }

    /**
     * @return array<string, mixed>
     */
    private function serialiser(Notification $notification, bool $lue): array
    {
        return [
            'id' => $notification->getId(),
            'type' => $notification->getType(),
            'titre' => $notification->getTitre(),
            'message' => $notification->getMessage(),
            'cible_type' => $notification->getCibleType(),
            'cible_reference' => $notification->getCibleReference(),
            'lien' => $notification->getLien(),
            'donnees' => $notification->getDonnees(),
            'date_creation' => $notification->getDateCreation()->format(\DateTimeInterface::ATOM),
            'lue' => $lue,
        ];
    }
}
