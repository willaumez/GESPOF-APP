<?php

declare(strict_types=1);

namespace App\Shared\Entite;

use App\Shared\Repository\NotificationRepository;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity(repositoryClass: NotificationRepository::class)]
#[ORM\Table(name: 'notification')]
#[ORM\Index(name: 'idx_notification_portail_date', columns: ['portail', 'date_creation'])]
class Notification
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\Column(name: 'portail', length: 16)]
    private string $portail;

    #[ORM\Column(name: 'type', length: 64)]
    private string $type;

    #[ORM\Column(name: 'titre', length: 180)]
    private string $titre;

    #[ORM\Column(name: 'message', length: 500)]
    private string $message;

    #[ORM\Column(name: 'cible_type', length: 64, nullable: true)]
    private ?string $cibleType = null;

    #[ORM\Column(name: 'cible_reference', length: 40, nullable: true)]
    private ?string $cibleReference = null;

    #[ORM\Column(name: 'lien', length: 255, nullable: true)]
    private ?string $lien = null;

    /** @var array<string, mixed>|null */
    #[ORM\Column(name: 'donnees', type: Types::JSON, nullable: true)]
    private ?array $donnees = null;

    #[ORM\Column(name: 'date_creation', type: Types::DATETIME_IMMUTABLE)]
    private \DateTimeImmutable $dateCreation;

    /** @var Collection<int, NotificationLecture> */
    #[ORM\OneToMany(targetEntity: NotificationLecture::class, mappedBy: 'notification', cascade: ['persist', 'remove'])]
    private Collection $lectures;

    public function __construct(
        string $portail,
        string $type,
        string $titre,
        string $message,
    ) {
        $this->portail = $portail;
        $this->type = $type;
        $this->titre = $titre;
        $this->message = $message;
        $this->dateCreation = new \DateTimeImmutable();
        $this->lectures = new ArrayCollection();
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getPortail(): string
    {
        return $this->portail;
    }

    public function getType(): string
    {
        return $this->type;
    }

    public function getTitre(): string
    {
        return $this->titre;
    }

    public function getMessage(): string
    {
        return $this->message;
    }

    public function getCibleType(): ?string
    {
        return $this->cibleType;
    }

    public function setCibleType(?string $cibleType): static
    {
        $this->cibleType = $cibleType;

        return $this;
    }

    public function getCibleReference(): ?string
    {
        return $this->cibleReference;
    }

    public function setCibleReference(?string $cibleReference): static
    {
        $this->cibleReference = $cibleReference;

        return $this;
    }

    public function getLien(): ?string
    {
        return $this->lien;
    }

    public function setLien(?string $lien): static
    {
        $this->lien = $lien;

        return $this;
    }

    /** @return array<string, mixed>|null */
    public function getDonnees(): ?array
    {
        return $this->donnees;
    }

    /** @param array<string, mixed>|null $donnees */
    public function setDonnees(?array $donnees): static
    {
        $this->donnees = $donnees;

        return $this;
    }

    public function getDateCreation(): \DateTimeImmutable
    {
        return $this->dateCreation;
    }

    /** @return Collection<int, NotificationLecture> */
    public function getLectures(): Collection
    {
        return $this->lectures;
    }
}
