<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Entite\Referentiel;

use App\Module\ServiceOperationsFinancieres\Repository\TauxChangeRepository;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;

/**
 * Taux de change mensuel (exercice, mois, devise) — conversion TOFE.
 */
#[ORM\Entity(repositoryClass: TauxChangeRepository::class)]
#[ORM\Table(name: 'sof_taux_change')]
#[ORM\UniqueConstraint(name: 'uniq_sof_taux_change', columns: ['exercice_annee', 'mois', 'devise'])]
class TauxChange
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column(name: 'id', type: Types::INTEGER)]
    private ?int $id = null;

    #[ORM\Column(name: 'exercice_annee', type: Types::INTEGER)]
    private int $exerciceAnnee;

    #[ORM\Column(name: 'mois', type: Types::INTEGER)]
    private int $mois;

    #[ORM\Column(name: 'devise', type: Types::STRING, length: 8)]
    private string $devise;

    #[ORM\Column(name: 'taux', type: Types::DECIMAL, precision: 20, scale: 6)]
    private string $taux;

    public function __construct(int $exerciceAnnee, int $mois, string $devise, string $taux)
    {
        $this->exerciceAnnee = $exerciceAnnee;
        $this->mois = $mois;
        $this->devise = strtoupper($devise);
        $this->taux = $taux;
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getExerciceAnnee(): int
    {
        return $this->exerciceAnnee;
    }

    public function getMois(): int
    {
        return $this->mois;
    }

    public function getDevise(): string
    {
        return $this->devise;
    }

    public function getTaux(): string
    {
        return $this->taux;
    }

    public function setTaux(string $taux): static
    {
        $this->taux = $taux;

        return $this;
    }
}
