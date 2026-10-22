<?php

declare(strict_types=1);

namespace App\Module\ServicePrevision\Entite\JourneeTresorerie;

use App\Shared\Entite\Utilisateur;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;

/**
 * Événement métier d'une journée de trésorerie (audit journalier) : qui a fait
 * quoi, et quand, de l'ouverture à la clôture (et aux réouvertures).
 *
 * Contrairement au journal HTTP (audit_action), l'événement est rattaché à la
 * journée et porte un libellé lisible. L'identité de l'acteur est dénormalisée
 * pour survivre à la suppression du compte.
 */
#[ORM\Entity]
#[ORM\Table(name: 'journee_evenement')]
#[ORM\Index(name: 'idx_journee_evenement_journee_date', columns: ['journee_reference', 'date_evenement'])]
class EvenementJournee
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column(type: Types::INTEGER)]
    private ?int $id = null;

    #[ORM\ManyToOne(targetEntity: JourneeTresorerie::class)]
    #[ORM\JoinColumn(name: 'journee_reference', referencedColumnName: 'reference', nullable: false, onDelete: 'CASCADE')]
    private JourneeTresorerie $journee;

    /** Code stable (ex. « cloture », « rapprochement ») : filtrage et icône côté interface. */
    #[ORM\Column(length: 40)]
    private string $type;

    #[ORM\Column(length: 500)]
    private string $libelle;

    /** Données complémentaires (montants avant / après, références…). */
    #[ORM\Column(type: Types::JSON, nullable: true)]
    private ?array $details;

    #[ORM\ManyToOne(targetEntity: Utilisateur::class)]
    #[ORM\JoinColumn(name: 'utilisateur_id', referencedColumnName: 'id', nullable: true, onDelete: 'SET NULL')]
    private ?Utilisateur $utilisateur = null;

    /** Nom affiché de l'acteur (« Système » si aucune session). */
    #[ORM\Column(name: 'nom_complet', length: 255)]
    private string $nomComplet = 'Système';

    #[ORM\Column(length: 64)]
    private string $matricule = '';

    /** Métier de l'acteur au moment de l'action (RoleAcces), vide si inconnu. */
    #[ORM\Column(length: 64)]
    private string $role = '';

    #[ORM\Column(name: 'date_evenement', type: Types::DATETIME_IMMUTABLE)]
    private \DateTimeImmutable $dateEvenement;

    /**
     * @param array<string, mixed>|null $details
     */
    public function __construct(JourneeTresorerie $journee, string $type, string $libelle, ?array $details = null)
    {
        $this->journee = $journee;
        $this->type = $type;
        $this->libelle = mb_substr($libelle, 0, 500);
        $this->details = $details === [] ? null : $details;
        $this->dateEvenement = new \DateTimeImmutable();
    }

    /** « 1250000.00 » → « 1 250 000 FCFA » (libellés d'événements). */
    public static function formaterMontant(string|float $montant): string
    {
        return number_format((float) $montant, 0, ',', ' ').' FCFA';
    }

    public function attribuerA(?Utilisateur $utilisateur): static
    {
        $this->utilisateur = $utilisateur;
        if ($utilisateur !== null) {
            $this->nomComplet = trim($utilisateur->getPrenom().' '.$utilisateur->getNom()) ?: 'Utilisateur';
            $this->matricule = $utilisateur->getMatricule();
            $this->role = ($utilisateur->getRolesAcces()[0] ?? null)?->value ?? '';
        }

        return $this;
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getJournee(): JourneeTresorerie
    {
        return $this->journee;
    }

    public function getType(): string
    {
        return $this->type;
    }

    public function getLibelle(): string
    {
        return $this->libelle;
    }

    /** @return array<string, mixed>|null */
    public function getDetails(): ?array
    {
        return $this->details;
    }

    public function getUtilisateur(): ?Utilisateur
    {
        return $this->utilisateur;
    }

    public function getNomComplet(): string
    {
        return $this->nomComplet;
    }

    public function getMatricule(): string
    {
        return $this->matricule;
    }

    public function getRole(): string
    {
        return $this->role;
    }

    public function getDateEvenement(): \DateTimeImmutable
    {
        return $this->dateEvenement;
    }
}
