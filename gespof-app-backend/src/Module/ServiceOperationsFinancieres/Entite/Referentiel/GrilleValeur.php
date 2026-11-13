<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Entite\Referentiel;

use App\Module\ServiceOperationsFinancieres\Repository\GrilleValeurRepository;
use App\Module\ServiceOperationsFinancieres\Support\Montant;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity(repositoryClass: GrilleValeurRepository::class)]
#[ORM\Table(name: 'sof_grille_valeur')]
#[ORM\UniqueConstraint(name: 'uq_sof_grille_valeur_ligne_mois', columns: ['grille_ligne_id', 'mois'])]
class GrilleValeur
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column(name: 'id', type: Types::INTEGER)]
    private ?int $id = null;

    #[ORM\ManyToOne(targetEntity: GrilleLigne::class, inversedBy: 'valeurs')]
    #[ORM\JoinColumn(name: 'grille_ligne_id', referencedColumnName: 'id', nullable: false, onDelete: 'CASCADE')]
    private ?GrilleLigne $ligne = null;

    #[ORM\Column(name: 'mois', type: Types::SMALLINT)]
    private int $mois;

    #[ORM\Column(name: 'montant', type: Types::DECIMAL, precision: 20, scale: 2)]
    private string $montant = '0.00';

    public function __construct(int $mois, string $montant = '0.00')
    {
        if ($mois < 1 || $mois > 12) {
            throw new \InvalidArgumentException('Le mois doit être entre 1 et 12.');
        }
        $this->mois = $mois;
        $this->montant = Montant::normaliser($montant);
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getLigne(): ?GrilleLigne
    {
        return $this->ligne;
    }

    public function setLigne(?GrilleLigne $ligne): static
    {
        $this->ligne = $ligne;

        return $this;
    }

    public function getMois(): int
    {
        return $this->mois;
    }

    public function getMontant(): string
    {
        return $this->montant;
    }

    public function setMontant(string $montant): static
    {
        $this->montant = Montant::normaliser($montant);

        return $this;
    }
}
