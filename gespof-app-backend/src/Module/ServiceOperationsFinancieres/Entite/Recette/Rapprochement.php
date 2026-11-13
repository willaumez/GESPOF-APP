<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Entite\Recette;

use App\Module\ServiceOperationsFinancieres\Entite\Periode;
use App\Module\ServiceOperationsFinancieres\Enum\DomaineRapprochement;
use App\Module\ServiceOperationsFinancieres\Repository\RapprochementRepository;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;

/**
 * Rapprochement DOMF / DRPHP (plan phase 1 — rapprochement).
 * Unique (periode, domaine, cle) ; écart = montant_domf − montant_externe.
 */
#[ORM\Entity(repositoryClass: RapprochementRepository::class)]
#[ORM\Table(name: 'sof_rapprochement')]
#[ORM\UniqueConstraint(
    name: 'uniq_sof_rapprochement_periode_domaine_cle',
    columns: ['periode_id', 'domaine', 'cle'],
)]
#[ORM\Index(name: 'idx_sof_rapprochement_domaine_periode', columns: ['domaine', 'periode_id'])]
class Rapprochement
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column(name: 'id', type: Types::INTEGER)]
    private ?int $id = null;

    #[ORM\ManyToOne(targetEntity: Periode::class)]
    #[ORM\JoinColumn(name: 'periode_id', referencedColumnName: 'id', nullable: false, onDelete: 'CASCADE')]
    private Periode $periode;

    #[ORM\Column(name: 'domaine', type: Types::STRING, length: 16, enumType: DomaineRapprochement::class)]
    private DomaineRapprochement $domaine;

    /** Type de recette (PETROLE) ou compte (DOUANE). */
    #[ORM\Column(name: 'cle', type: Types::STRING, length: 64)]
    private string $cle;

    #[ORM\Column(name: 'montant_domf', type: Types::DECIMAL, precision: 20, scale: 2)]
    private string $montantDomf = '0.00';

    #[ORM\Column(name: 'montant_externe', type: Types::DECIMAL, precision: 20, scale: 2)]
    private string $montantExterne = '0.00';

    #[ORM\Column(name: 'commentaire', type: Types::STRING, length: 1000, nullable: true)]
    private ?string $commentaire = null;

    #[ORM\Column(name: 'valide_par', type: Types::STRING, length: 255, nullable: true)]
    private ?string $validePar = null;

    #[ORM\Column(name: 'valide_le', type: Types::DATETIME_IMMUTABLE, nullable: true)]
    private ?\DateTimeImmutable $valideLe = null;

    public function __construct(
        Periode $periode,
        DomaineRapprochement $domaine,
        string $cle,
        string $montantDomf = '0.00',
        string $montantExterne = '0.00',
    ) {
        $this->periode = $periode;
        $this->domaine = $domaine;
        $this->cle = $cle;
        $this->montantDomf = $montantDomf;
        $this->montantExterne = $montantExterne;
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getPeriode(): Periode
    {
        return $this->periode;
    }

    public function getDomaine(): DomaineRapprochement
    {
        return $this->domaine;
    }

    public function getCle(): string
    {
        return $this->cle;
    }

    public function getMontantDomf(): string
    {
        return $this->montantDomf;
    }

    public function setMontantDomf(string $montantDomf): static
    {
        $this->montantDomf = $montantDomf;

        return $this;
    }

    public function getMontantExterne(): string
    {
        return $this->montantExterne;
    }

    public function setMontantExterne(string $montantExterne): static
    {
        $this->montantExterne = $montantExterne;

        return $this;
    }

    public function getCommentaire(): ?string
    {
        return $this->commentaire;
    }

    public function setCommentaire(?string $commentaire): static
    {
        $t = $commentaire !== null ? trim($commentaire) : null;
        $this->commentaire = $t === '' ? null : $t;

        return $this;
    }

    public function getValidePar(): ?string
    {
        return $this->validePar;
    }

    public function getValideLe(): ?\DateTimeImmutable
    {
        return $this->valideLe;
    }

    public function estValide(): bool
    {
        return $this->valideLe !== null;
    }

    public function valider(string $par): static
    {
        $this->validePar = $par;
        $this->valideLe = new \DateTimeImmutable();

        return $this;
    }

    public function invalider(): static
    {
        $this->validePar = null;
        $this->valideLe = null;

        return $this;
    }

    public function ecart(): string
    {
        return bcsub($this->montantDomf, $this->montantExterne, 2);
    }
}
