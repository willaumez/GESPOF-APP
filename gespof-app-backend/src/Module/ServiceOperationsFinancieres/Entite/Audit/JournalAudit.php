<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Entite\Audit;

use App\Module\ServiceOperationsFinancieres\Repository\JournalAuditRepository;
use App\Shared\Entite\Utilisateur;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;

/**
 * Journal d'audit métier SOF (plan phase 0 — table journal_audit).
 * Différent de audit_action (journal HTTP transverse).
 */
#[ORM\Entity(repositoryClass: JournalAuditRepository::class)]
#[ORM\Table(name: 'sof_journal_audit')]
#[ORM\Index(name: 'idx_sof_journal_audit_objet', columns: ['objet_type', 'objet_id'])]
#[ORM\Index(name: 'idx_sof_journal_audit_horodatage', columns: ['horodatage'])]
class JournalAudit
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column(name: 'id', type: Types::INTEGER)]
    private ?int $id = null;

    #[ORM\Column(name: 'horodatage', type: Types::DATETIME_IMMUTABLE)]
    private \DateTimeImmutable $horodatage;

    #[ORM\ManyToOne(targetEntity: Utilisateur::class)]
    #[ORM\JoinColumn(name: 'utilisateur_id', referencedColumnName: 'id', nullable: true, onDelete: 'SET NULL')]
    private ?Utilisateur $utilisateur = null;

    /** Matricule dénormalisé (survie à la suppression du compte). */
    #[ORM\Column(name: 'matricule', type: Types::STRING, length: 255, nullable: true)]
    private ?string $matricule = null;

    #[ORM\Column(name: 'action', type: Types::STRING, length: 64)]
    private string $action;

    #[ORM\Column(name: 'objet_type', type: Types::STRING, length: 64)]
    private string $objetType;

    #[ORM\Column(name: 'objet_id', type: Types::STRING, length: 128)]
    private string $objetId;

    /** @var array<string, mixed>|null */
    #[ORM\Column(name: 'avant', type: Types::JSON, nullable: true, options: ['jsonb' => true])]
    private ?array $avant = null;

    /** @var array<string, mixed>|null */
    #[ORM\Column(name: 'apres', type: Types::JSON, nullable: true, options: ['jsonb' => true])]
    private ?array $apres = null;

    public function __construct(
        string $action,
        string $objetType,
        string $objetId,
        ?Utilisateur $utilisateur = null,
        ?array $avant = null,
        ?array $apres = null,
    ) {
        $this->horodatage = new \DateTimeImmutable();
        $this->action = $action;
        $this->objetType = $objetType;
        $this->objetId = $objetId;
        $this->utilisateur = $utilisateur;
        $this->matricule = $utilisateur?->getMatricule();
        $this->avant = $avant;
        $this->apres = $apres;
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getHorodatage(): \DateTimeImmutable
    {
        return $this->horodatage;
    }

    public function getUtilisateur(): ?Utilisateur
    {
        return $this->utilisateur;
    }

    public function getMatricule(): ?string
    {
        return $this->matricule;
    }

    public function getAction(): string
    {
        return $this->action;
    }

    public function getObjetType(): string
    {
        return $this->objetType;
    }

    public function getObjetId(): string
    {
        return $this->objetId;
    }

    /**
     * @return array<string, mixed>|null
     */
    public function getAvant(): ?array
    {
        return $this->avant;
    }

    /**
     * @return array<string, mixed>|null
     */
    public function getApres(): ?array
    {
        return $this->apres;
    }
}
