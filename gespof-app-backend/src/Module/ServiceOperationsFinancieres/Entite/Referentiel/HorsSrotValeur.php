<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Entite\Referentiel;

use App\Module\ServiceOperationsFinancieres\Repository\HorsSrotValeurRepository;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;

/**
 * Données hors SROT pour le tableau de bord (SPEC §11 — Brent, USD/XAF, OTA, TMP/PMP, PIB, débits).
 */
#[ORM\Entity(repositoryClass: HorsSrotValeurRepository::class)]
#[ORM\Table(name: 'sof_hors_srot_valeur')]
#[ORM\UniqueConstraint(
    name: 'uniq_sof_hors_srot_valeur',
    columns: ['exercice_annee', 'mois', 'code'],
)]
class HorsSrotValeur
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column(name: 'id', type: Types::INTEGER)]
    private ?int $id = null;

    #[ORM\Column(name: 'exercice_annee', type: Types::INTEGER)]
    private int $exerciceAnnee;

    /** 0 = annuel / hors mois ; 1–12 = mois. */
    #[ORM\Column(name: 'mois', type: Types::SMALLINT)]
    private int $mois;

    #[ORM\Column(name: 'code', type: Types::STRING, length: 64)]
    private string $code;

    #[ORM\Column(name: 'valeur', type: Types::STRING, length: 64)]
    private string $valeur = '0';

    public function __construct(int $exerciceAnnee, int $mois, string $code, string $valeur = '0')
    {
        $this->exerciceAnnee = $exerciceAnnee;
        $this->mois = $mois;
        $this->code = $code;
        $this->valeur = $valeur;
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

    public function getCode(): string
    {
        return $this->code;
    }

    public function getValeur(): string
    {
        return $this->valeur;
    }

    public function setValeur(string $valeur): static
    {
        $this->valeur = $valeur;

        return $this;
    }
}
