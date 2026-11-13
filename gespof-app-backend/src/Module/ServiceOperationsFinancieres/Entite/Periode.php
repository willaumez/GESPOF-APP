<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Entite;

use App\Module\ServiceOperationsFinancieres\Enum\StatutPeriode;
use App\Module\ServiceOperationsFinancieres\Repository\PeriodeRepository;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;

/**
 * Mois de production de la SROT.
 *
 * @see Plan SOF — table periode (id, exercice_annee, mois, date_situation, statut)
 */
#[ORM\Entity(repositoryClass: PeriodeRepository::class)]
#[ORM\Table(name: 'sof_periode')]
#[ORM\UniqueConstraint(name: 'uniq_sof_periode_exercice_mois', columns: ['exercice_annee', 'mois'])]
class Periode
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column(name: 'id', type: Types::INTEGER)]
    private ?int $id = null;

    #[ORM\ManyToOne(targetEntity: Exercice::class)]
    #[ORM\JoinColumn(name: 'exercice_annee', referencedColumnName: 'annee', nullable: false)]
    private Exercice $exercice;

    #[ORM\Column(name: 'mois', type: Types::INTEGER)]
    private int $mois;

    #[ORM\Column(name: 'date_situation', type: Types::DATE_IMMUTABLE, nullable: true)]
    private ?\DateTimeImmutable $dateSituation = null;

    #[ORM\Column(name: 'statut', type: Types::STRING, length: 20, enumType: StatutPeriode::class)]
    private StatutPeriode $statut;

    public function __construct(
        Exercice $exercice,
        int $mois,
        StatutPeriode $statut = StatutPeriode::OUVERTE,
        ?\DateTimeImmutable $dateSituation = null,
    ) {
        if ($mois < 1 || $mois > 12) {
            throw new \InvalidArgumentException(sprintf('Mois invalide : %d.', $mois));
        }

        $this->exercice = $exercice;
        $this->mois = $mois;
        $this->statut = $statut;
        $this->dateSituation = $dateSituation;
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getExercice(): Exercice
    {
        return $this->exercice;
    }

    public function getMois(): int
    {
        return $this->mois;
    }

    public function getDateSituation(): ?\DateTimeImmutable
    {
        return $this->dateSituation;
    }

    public function setDateSituation(?\DateTimeImmutable $dateSituation): static
    {
        $this->dateSituation = $dateSituation;

        return $this;
    }

    public function getStatut(): StatutPeriode
    {
        return $this->statut;
    }

    public function setStatut(StatutPeriode $statut): static
    {
        $this->statut = $statut;

        return $this;
    }
}
