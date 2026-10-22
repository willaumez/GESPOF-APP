<?php

declare(strict_types=1);

namespace App\Shared\Entite;

use App\Shared\Enum\Portail;
use App\Shared\Enum\RoleAcces;
use App\Shared\Repository\AuditActionRepository;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;

/**
 * Entrée du journal d'actions HTTP : une ligne par requête mutante
 * (POST / PUT / PATCH / DELETE) ou authentification. L'identité est
 * dénormalisée pour survivre à la suppression du compte.
 */
#[ORM\Entity(repositoryClass: AuditActionRepository::class)]
#[ORM\Table(name: 'audit_action')]
#[ORM\Index(name: 'idx_audit_action_date', columns: ['date_action'])]
#[ORM\Index(name: 'idx_audit_action_module', columns: ['module'])]
#[ORM\Index(name: 'idx_audit_action_portail', columns: ['portail'])]
#[ORM\Index(name: 'idx_audit_action_utilisateur', columns: ['utilisateur_id'])]
class AuditAction
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column(type: Types::INTEGER)]
    private ?int $id = null;

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

    /** Portail de l'acteur (métier), null si inconnu (ex. connexion échouée). */
    #[ORM\Column(length: 16, nullable: true)]
    private ?string $portail = null;

    /** Module ciblé par l'URL : SP, SR, SOF, ADMIN, AUTH, SHARED. */
    #[ORM\Column(length: 16)]
    private string $module = 'SHARED';

    #[ORM\Column(length: 10)]
    private string $methode = 'POST';

    #[ORM\Column(length: 512)]
    private string $chemin = '';

    #[ORM\Column(length: 255)]
    private string $action = '';

    /** Corps de requête, secrets masqués. */
    #[ORM\Column(type: Types::JSON, nullable: true)]
    private ?array $corps = null;

    #[ORM\Column(name: 'code_http', type: Types::INTEGER)]
    private int $codeHttp = 200;

    #[ORM\Column(name: 'adresse_ip', length: 45, nullable: true)]
    private ?string $adresseIp = null;

    #[ORM\Column(name: 'user_agent', length: 512, nullable: true)]
    private ?string $userAgent = null;

    #[ORM\Column(name: 'date_action', type: Types::DATETIME_IMMUTABLE)]
    private \DateTimeImmutable $dateAction;

    #[ORM\Column(name: 'session_uuid', length: 36, nullable: true)]
    private ?string $sessionUuid = null;

    public function __construct()
    {
        $this->dateAction = new \DateTimeImmutable();
    }

    public function getId(): ?int
    {
        return $this->id;
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

    public function getModule(): string
    {
        return $this->module;
    }

    public function setModule(string $module): static
    {
        $this->module = $module;

        return $this;
    }

    public function getMethode(): string
    {
        return $this->methode;
    }

    public function setMethode(string $methode): static
    {
        $this->methode = $methode;

        return $this;
    }

    public function getChemin(): string
    {
        return $this->chemin;
    }

    public function setChemin(string $chemin): static
    {
        $this->chemin = $chemin;

        return $this;
    }

    public function getAction(): string
    {
        return $this->action;
    }

    public function setAction(string $action): static
    {
        $this->action = $action;

        return $this;
    }

    public function getCorps(): ?array
    {
        return $this->corps;
    }

    public function setCorps(?array $corps): static
    {
        $this->corps = $corps;

        return $this;
    }

    public function getCodeHttp(): int
    {
        return $this->codeHttp;
    }

    public function setCodeHttp(int $codeHttp): static
    {
        $this->codeHttp = $codeHttp;

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

    public function getDateAction(): \DateTimeImmutable
    {
        return $this->dateAction;
    }

    public function setDateAction(\DateTimeImmutable $dateAction): static
    {
        $this->dateAction = $dateAction;

        return $this;
    }

    public function getSessionUuid(): ?string
    {
        return $this->sessionUuid;
    }

    public function setSessionUuid(?string $sessionUuid): static
    {
        $this->sessionUuid = $sessionUuid;

        return $this;
    }
}
