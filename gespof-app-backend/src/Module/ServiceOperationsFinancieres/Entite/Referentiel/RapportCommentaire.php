<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Entite\Referentiel;

use App\Module\ServiceOperationsFinancieres\Entite\Periode;
use App\Module\ServiceOperationsFinancieres\Repository\RapportCommentaireRepository;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;

/**
 * Commentaires Fiche SROT / Note CGE (SPEC §11).
 */
#[ORM\Entity(repositoryClass: RapportCommentaireRepository::class)]
#[ORM\Table(name: 'sof_rapport_commentaire')]
#[ORM\UniqueConstraint(name: 'uniq_sof_rapport_commentaire', columns: ['periode_id', 'cle'])]
class RapportCommentaire
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column(name: 'id', type: Types::INTEGER)]
    private ?int $id = null;

    #[ORM\ManyToOne(targetEntity: Periode::class)]
    #[ORM\JoinColumn(name: 'periode_id', referencedColumnName: 'id', nullable: false, onDelete: 'CASCADE')]
    private Periode $periode;

    /** ex. commentaire_recettes, commentaire_depenses, commentaire_financement */
    #[ORM\Column(name: 'cle', type: Types::STRING, length: 64)]
    private string $cle;

    #[ORM\Column(name: 'texte', type: Types::TEXT)]
    private string $texte = '';

    public function __construct(Periode $periode, string $cle, string $texte = '')
    {
        $this->periode = $periode;
        $this->cle = $cle;
        $this->texte = $texte;
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getPeriode(): Periode
    {
        return $this->periode;
    }

    public function getCle(): string
    {
        return $this->cle;
    }

    public function getTexte(): string
    {
        return $this->texte;
    }

    public function setTexte(string $texte): static
    {
        $this->texte = $texte;

        return $this;
    }
}
