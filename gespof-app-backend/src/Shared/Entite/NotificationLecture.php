<?php

declare(strict_types=1);

namespace App\Shared\Entite;

use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity]
#[ORM\Table(name: 'notification_lecture')]
#[ORM\UniqueConstraint(name: 'UNIQ_NOTIF_LECTURE_USER', columns: ['notification_id', 'utilisateur_id'])]
class NotificationLecture
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\ManyToOne(targetEntity: Notification::class, inversedBy: 'lectures')]
    #[ORM\JoinColumn(name: 'notification_id', referencedColumnName: 'id', nullable: false, onDelete: 'CASCADE')]
    private Notification $notification;

    #[ORM\ManyToOne(targetEntity: Utilisateur::class)]
    #[ORM\JoinColumn(name: 'utilisateur_id', referencedColumnName: 'id', nullable: false, onDelete: 'CASCADE')]
    private Utilisateur $utilisateur;

    #[ORM\Column(name: 'date_lecture', type: Types::DATETIME_IMMUTABLE)]
    private \DateTimeImmutable $dateLecture;

    public function __construct(Notification $notification, Utilisateur $utilisateur)
    {
        $this->notification = $notification;
        $this->utilisateur = $utilisateur;
        $this->dateLecture = new \DateTimeImmutable();
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getNotification(): Notification
    {
        return $this->notification;
    }

    public function getUtilisateur(): Utilisateur
    {
        return $this->utilisateur;
    }

    public function getDateLecture(): \DateTimeImmutable
    {
        return $this->dateLecture;
    }
}
