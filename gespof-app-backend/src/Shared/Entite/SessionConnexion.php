<?php

declare(strict_types=1);

namespace App\Shared\Entite;

use App\Shared\Enum\MotifDeconnexion;
use App\Shared\Enum\Portail;
use App\Shared\Enum\RoleAcces;
use App\Shared\Repository\SessionConnexionRepository;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;

/**
 * Session de connexion d'un utilisateur : ouverte à l'authentification,
 * fermée à la déconnexion (explicite, inactivité) ou à l'expiration du jeton.
 * Les champs d'identité sont dénormalisés pour conserver le journal si le
 * compte est ensuite supprimé (FK ON DELETE SET NULL).
 */
#[ORM\Entity(repositoryClass: SessionConnexionRepository::class)]
#[ORM\Table(name: 'session_connexion')]
#[ORM\Index(name: 'idx_session_connexion_portail', columns: ['portail'])]
#[ORM\Index(name: 'idx_session_connexion_date_connexion', columns: ['date_connexion'])]
#[ORM\Index(name: 'idx_session_connexion_date_deconnexion', columns: ['date_deconnexion'])]
class SessionConnexion
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column(type: Types::INTEGER)]
    private ?int $id = null;

    #[ORM\Column(type: Types::GUID, unique: true)]
    private string $uuid;

    #[ORM\ManyToOne(targetEntity: Utilisateur::class)]
    #[ORM\JoinColumn(name: 'utilisateur_id', referencedColumnName: 'id', nullable: true, onDelete: 'SET NULL')]
    private ?Utilisateur $utilisateur = null;

    #[ORM\Column(length: 255)]
    private string $matricule = '';

    #[ORM\Column(length: 255)]
    private string $nom = '';

    #[ORM\Column(length: 255)]
    private string $prenom = '';

    #[ORM\Column(length: 255)]
    private string $email = '';

    #[ORM\Column(length: 64)]
    private string $role = '';

    #[ORM\Column(length: 16, nullable: true)]
    private ?string $portail = null;

    #[ORM\Column(name: 'date_connexion', type: Types::DATETIME_IMMUTABLE)]
    private \DateTimeImmutable $dateConnexion;

    #[ORM\Column(name: 'date_deconnexion', type: Types::DATETIME_IMMUTABLE, nullable: true)]
    private ?\DateTimeImmutable $dateDeconnexion = null;

    #[ORM\Column(name: 'date_expiration_jeton', type: Types::DATETIME_IMMUTABLE)]
    private \DateTimeImmutable $dateExpirationJeton;

    #[ORM\Column(name: 'motif_deconnexion', length: 32, nullable: true)]
    private ?string $motifDeconnexion = null;

    #[ORM\Column(name: 'adresse_ip', length: 45, nullable: true)]
    private ?string $adresseIp = null;

    #[ORM\Column(name: 'user_agent', length: 512, nullable: true)]
    private ?string $userAgent = null;

    public function __construct()
    {
        $this->uuid = self::genererUuid();
        $this->dateConnexion = new \DateTimeImmutable();
        $this->dateExpirationJeton = new \DateTimeImmutable('+1 hour');
    }

    private static function genererUuid(): string
    {
        $octets = random_bytes(16);
        $octets[6] = chr(ord($octets[6]) & 0x0f | 0x40);
        $octets[8] = chr(ord($octets[8]) & 0x3f | 0x80);
        $hex = bin2hex($octets);

        return sprintf(
            '%s-%s-%s-%s-%s',
            substr($hex, 0, 8),
            substr($hex, 8, 4),
            substr($hex, 12, 4),
            substr($hex, 16, 4),
            substr($hex, 20, 12),
        );
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getUuid(): string
    {
        return $this->uuid;
    }

    public function getUtilisateur(): ?Utilisateur
    {
        return $this->utilisateur;
    }

    public function setUtilisateur(?Utilisateur $utilisateur): static
    {
        $this->utilisateur = $utilisateur;

        return $this;
    }

    public function getMatricule(): string
    {
        return $this->matricule;
    }

    public function setMatricule(string $matricule): static
    {
        $this->matricule = $matricule;

        return $this;
    }

    public function getNom(): string
    {
        return $this->nom;
    }

    public function setNom(string $nom): static
    {
        $this->nom = $nom;

        return $this;
    }

    public function getPrenom(): string
    {
        return $this->prenom;
    }

    public function setPrenom(string $prenom): static
    {
        $this->prenom = $prenom;

        return $this;
    }

    public function getEmail(): string
    {
        return $this->email;
    }

    public function setEmail(string $email): static
    {
        $this->email = $email;

        return $this;
    }

    public function getRole(): string
    {
        return $this->role;
    }

    public function setRole(string $role): static
    {
        $this->role = $role;

        return $this;
    }

    public function getRoleAcces(): ?RoleAcces
    {
        return RoleAcces::tryFrom($this->role);
    }

    public function getPortail(): ?string
    {
        return $this->portail;
    }

    public function getPortailEnum(): ?Portail
    {
        return $this->portail !== null ? Portail::tryFrom($this->portail) : null;
    }

    public function setPortail(?string $portail): static
    {
        $this->portail = $portail;

        return $this;
    }

    public function getDateConnexion(): \DateTimeImmutable
    {
        return $this->dateConnexion;
    }

    public function setDateConnexion(\DateTimeImmutable $dateConnexion): static
    {
        $this->dateConnexion = $dateConnexion;

        return $this;
    }

    public function getDateDeconnexion(): ?\DateTimeImmutable
    {
        return $this->dateDeconnexion;
    }

    public function setDateDeconnexion(?\DateTimeImmutable $dateDeconnexion): static
    {
        $this->dateDeconnexion = $dateDeconnexion;

        return $this;
    }

    public function getDateExpirationJeton(): \DateTimeImmutable
    {
        return $this->dateExpirationJeton;
    }

    public function setDateExpirationJeton(\DateTimeImmutable $dateExpirationJeton): static
    {
        $this->dateExpirationJeton = $dateExpirationJeton;

        return $this;
    }

    public function getMotifDeconnexion(): ?string
    {
        return $this->motifDeconnexion;
    }

    public function getMotifDeconnexionEnum(): ?MotifDeconnexion
    {
        return $this->motifDeconnexion !== null ? MotifDeconnexion::tryFrom($this->motifDeconnexion) : null;
    }

    public function setMotifDeconnexion(?string $motifDeconnexion): static
    {
        $this->motifDeconnexion = $motifDeconnexion;

        return $this;
    }

    public function getAdresseIp(): ?string
    {
        return $this->adresseIp;
    }

    public function setAdresseIp(?string $adresseIp): static
    {
        $this->adresseIp = $adresseIp;

        return $this;
    }

    public function getUserAgent(): ?string
    {
        return $this->userAgent;
    }

    public function setUserAgent(?string $userAgent): static
    {
        $this->userAgent = $userAgent;

        return $this;
    }

    public function estOuverte(): bool
    {
        return $this->dateDeconnexion === null;
    }

    public function cloturer(\DateTimeImmutable $instant, MotifDeconnexion $motif): static
    {
        if ($this->dateDeconnexion === null) {
            $this->dateDeconnexion = $instant;
            $this->motifDeconnexion = $motif->value;
        }

        return $this;
    }
}
