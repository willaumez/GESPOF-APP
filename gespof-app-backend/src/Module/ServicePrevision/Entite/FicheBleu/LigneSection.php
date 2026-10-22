<?php

declare(strict_types=1);

namespace App\Module\ServicePrevision\Entite\FicheBleu;

use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;

/**
 * Ligne de détail d'une Section (une ligne bancaire de la Fiche Bleue), avec
 * un montant programmé, un montant réalisé et leur écart.
 */
#[ORM\Entity]
#[ORM\Table(name: 'ligne_section')]
class LigneSection
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column(type: Types::INTEGER)]
    private ?int $id = null;

    #[ORM\Column(name: 'libelle_bancaire', length: 255)]
    private string $libelleBancaire;

    #[ORM\Column(name: 'montant_programme', type: Types::DECIMAL, precision: 15, scale: 2)]
    private string $montantProgramme = '0.00';

    #[ORM\Column(name: 'montant_realise', type: Types::DECIMAL, precision: 15, scale: 2)]
    private string $montantRealise = '0.00';

    /** Écart = montantRealise - montantProgramme. */
    #[ORM\Column(name: 'montant_ecart', type: Types::DECIMAL, precision: 15, scale: 2)]
    private string $montantEcart = '0.00';

    #[ORM\Column(name: 'ordre', type: Types::INTEGER)]
    private int $ordre;

    #[ORM\Column(name: 'est_actif', type: Types::BOOLEAN)]
    private bool $estActif = true;

    /**
     * true si cette ligne est elle-même un total du fichier bancaire
     * d'origine : elle ne doit alors pas être re-additionnée dans
     * Section::calculerMontantProgramme() / calculerMontantRealise(),
     * sous peine de compter deux fois le même montant.
     */
    #[ORM\Column(name: 'est_total', type: Types::BOOLEAN)]
    private bool $estTotal = false;

    /** false : ligne figée (générée par le système), non éditable par l'agent. */
    #[ORM\Column(name: 'est_modifiable', type: Types::BOOLEAN)]
    private bool $estModifiable = true;

    #[ORM\ManyToOne(targetEntity: Section::class, inversedBy: 'lignes')]
    #[ORM\JoinColumn(name: 'section_id', referencedColumnName: 'id', nullable: false)]
    private ?Section $section = null;

    public function __construct(string $libelleBancaire, int $ordre)
    {
        $this->libelleBancaire = $libelleBancaire;
        $this->ordre = $ordre;
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getLibelleBancaire(): string
    {
        return $this->libelleBancaire;
    }

    public function setLibelleBancaire(string $libelleBancaire): static
    {
        $this->libelleBancaire = $libelleBancaire;

        return $this;
    }

    /**
     * Montants monétaires représentés en chaînes décimales (BigDecimal du
     * diagramme) pour conserver la précision.
     */
    public function getMontantProgramme(): string
    {
        return $this->montantProgramme;
    }

    public function setMontantProgramme(string $montantProgramme): static
    {
        $this->montantProgramme = $montantProgramme;

        return $this;
    }

    public function getMontantRealise(): string
    {
        return $this->montantRealise;
    }

    public function setMontantRealise(string $montantRealise): static
    {
        $this->montantRealise = $montantRealise;

        return $this;
    }

    public function getMontantEcart(): string
    {
        return $this->montantEcart;
    }

    /**
     * Fixe montantEcart = montantProgramme - montantRealise.
     * Si le réalisé est à 0, l'écart n'est pas calculé (reste 0.00).
     */
    public function calculerEcart(): string
    {
        if (bccomp($this->montantRealise, '0', 2) === 0) {
            $this->montantEcart = '0.00';
        } else {
            $this->montantEcart = bcsub($this->montantProgramme, $this->montantRealise, 2);
        }

        return $this->montantEcart;
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

    public function estActif(): bool
    {
        return $this->estActif;
    }

    public function setEstActif(bool $estActif): static
    {
        $this->estActif = $estActif;

        return $this;
    }

    public function estTotal(): bool
    {
        return $this->estTotal;
    }

    public function setEstTotal(bool $estTotal): static
    {
        $this->estTotal = $estTotal;

        return $this;
    }

    public function estModifiable(): bool
    {
        return $this->estModifiable;
    }

    public function setEstModifiable(bool $estModifiable): static
    {
        $this->estModifiable = $estModifiable;

        return $this;
    }

    public function getSection(): ?Section
    {
        return $this->section;
    }

    public function setSection(?Section $section): static
    {
        $this->section = $section;

        return $this;
    }

    /** Copie de la ligne, sans identifiant ni rattachement à une Section. */
    public function copier(): self
    {
        $copie = new self($this->libelleBancaire, $this->ordre);
        $copie->montantProgramme = $this->montantProgramme;
        $copie->montantRealise = $this->montantRealise;
        $copie->montantEcart = $this->montantEcart;
        $copie->estActif = $this->estActif;
        $copie->estTotal = $this->estTotal;
        $copie->estModifiable = $this->estModifiable;

        return $copie;
    }
}
