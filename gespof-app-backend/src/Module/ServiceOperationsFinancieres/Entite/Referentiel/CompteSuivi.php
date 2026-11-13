<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Entite\Referentiel;

use App\Module\ServiceOperationsFinancieres\Enum\FamilleCompteSuivi;
use App\Module\ServiceOperationsFinancieres\Repository\CompteSuiviRepository;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;

/**
 * Compte de suivi douanes / pétrole (plan phase 0 — table compte_suivi).
 * Clé primaire composite : compte + nature.
 */
#[ORM\Entity(repositoryClass: CompteSuiviRepository::class)]
#[ORM\Table(name: 'sof_compte_suivi')]
#[ORM\Index(name: 'idx_sof_compte_suivi_famille_ordre', columns: ['famille', 'ordre'])]
#[ORM\Index(name: 'idx_sof_compte_suivi_type_ordre', columns: ['type', 'ordre'])]
class CompteSuivi
{
    #[ORM\Id]
    #[ORM\Column(name: 'compte', type: Types::STRING, length: 32)]
    private string $compte;

    #[ORM\Id]
    #[ORM\Column(name: 'nature', type: Types::STRING, length: 16)]
    private string $nature;

    #[ORM\Column(name: 'libelle', type: Types::STRING, length: 255)]
    private string $libelle;

    #[ORM\Column(name: 'famille', type: Types::STRING, length: 16, enumType: FamilleCompteSuivi::class)]
    private FamilleCompteSuivi $famille;

    #[ORM\Column(name: 'type', type: Types::STRING, length: 64)]
    private string $type;

    #[ORM\Column(name: 'bancaire_seulement', type: Types::BOOLEAN, options: ['default' => false])]
    private bool $bancaireSeulement = false;

    #[ORM\Column(name: 'ordre', type: Types::INTEGER)]
    private int $ordre = 1;

    /** Nom de feuille attendu (ex. 4781-11-4). */
    #[ORM\Column(name: 'fichier', type: Types::STRING, length: 64, nullable: true)]
    private ?string $fichier = null;

    public function __construct(
        string $compte,
        string $nature,
        string $libelle,
        FamilleCompteSuivi $famille,
        string $type,
        int $ordre = 1,
        bool $bancaireSeulement = false,
        ?string $fichier = null,
    ) {
        $this->compte = $compte;
        $this->nature = $nature;
        $this->libelle = $libelle;
        $this->famille = $famille;
        $this->type = $type;
        $this->ordre = $ordre;
        $this->bancaireSeulement = $bancaireSeulement;
        $this->fichier = $fichier !== null && trim($fichier) !== '' ? trim($fichier) : null;
    }

    public function getCompte(): string
    {
        return $this->compte;
    }

    public function getNature(): string
    {
        return $this->nature;
    }

    public function getLibelle(): string
    {
        return $this->libelle;
    }

    public function setLibelle(string $libelle): static
    {
        $this->libelle = $libelle;

        return $this;
    }

    public function getFamille(): FamilleCompteSuivi
    {
        return $this->famille;
    }

    public function setFamille(FamilleCompteSuivi $famille): static
    {
        $this->famille = $famille;

        return $this;
    }

    public function getType(): string
    {
        return $this->type;
    }

    public function setType(string $type): static
    {
        $this->type = $type;

        return $this;
    }

    public function isBancaireSeulement(): bool
    {
        return $this->bancaireSeulement;
    }

    public function setBancaireSeulement(bool $bancaireSeulement): static
    {
        $this->bancaireSeulement = $bancaireSeulement;

        return $this;
    }

    public function getOrdre(): int
    {
        return $this->ordre;
    }

    public function setOrdre(int $ordre): static
    {
        $this->ordre = $ordre;

        return $this;
    }

    public function getFichier(): ?string
    {
        return $this->fichier;
    }

    public function setFichier(?string $fichier): static
    {
        $this->fichier = $fichier !== null && trim($fichier) !== '' ? trim($fichier) : null;

        return $this;
    }
}
