<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Entite\Referentiel;

use App\Module\ServiceOperationsFinancieres\Repository\SrotArchiveRepository;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;

/**
 * Archive SROT figée à la validation (SPEC §8.2 / §9 / §12 — srot_archive).
 * Valeur = cumul à date en millions, 6 décimales (équivalent Cumul SROT).
 */
#[ORM\Entity(repositoryClass: SrotArchiveRepository::class)]
#[ORM\Table(name: 'sof_srot_archive')]
#[ORM\UniqueConstraint(
    name: 'uniq_sof_srot_archive',
    columns: ['exercice_annee', 'mois', 'ligne_srot'],
)]
#[ORM\Index(name: 'idx_sof_srot_archive_exercice_mois', columns: ['exercice_annee', 'mois'])]
class SrotArchive
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column(name: 'id', type: Types::INTEGER)]
    private ?int $id = null;

    #[ORM\Column(name: 'exercice_annee', type: Types::INTEGER)]
    private int $exerciceAnnee;

    #[ORM\Column(name: 'mois', type: Types::INTEGER)]
    private int $mois;

    /** Identifiant de ligne situation (A, B, B_PET, … J). */
    #[ORM\Column(name: 'ligne_srot', type: Types::STRING, length: 32)]
    private string $ligneSrot;

    #[ORM\Column(name: 'libelle', type: Types::STRING, length: 255)]
    private string $libelle;

    /** Cumul à date en millions (6 décimales). */
    #[ORM\Column(name: 'valeur_cumul_millions', type: Types::DECIMAL, precision: 24, scale: 6)]
    private string $valeurCumulMillions = '0.000000';

    /** Cumul à date en FCFA (trace GESPOF). */
    #[ORM\Column(name: 'valeur_cumul_fcfa', type: Types::DECIMAL, precision: 20, scale: 2)]
    private string $valeurCumulFcfa = '0.00';

    /** Mois en FCFA. */
    #[ORM\Column(name: 'valeur_mois_fcfa', type: Types::DECIMAL, precision: 20, scale: 2)]
    private string $valeurMoisFcfa = '0.00';

    #[ORM\Column(name: 'niveau', type: Types::SMALLINT)]
    private int $niveau = 0;

    #[ORM\Column(name: 'archive_le', type: Types::DATETIME_IMMUTABLE)]
    private \DateTimeImmutable $archiveLe;

    public function __construct(
        int $exerciceAnnee,
        int $mois,
        string $ligneSrot,
        string $libelle,
        string $valeurCumulMillions,
        string $valeurCumulFcfa,
        string $valeurMoisFcfa,
        int $niveau = 0,
    ) {
        $this->exerciceAnnee = $exerciceAnnee;
        $this->mois = $mois;
        $this->ligneSrot = $ligneSrot;
        $this->libelle = $libelle;
        $this->valeurCumulMillions = $valeurCumulMillions;
        $this->valeurCumulFcfa = $valeurCumulFcfa;
        $this->valeurMoisFcfa = $valeurMoisFcfa;
        $this->niveau = $niveau;
        $this->archiveLe = new \DateTimeImmutable();
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

    public function getLigneSrot(): string
    {
        return $this->ligneSrot;
    }

    public function getLibelle(): string
    {
        return $this->libelle;
    }

    public function getValeurCumulMillions(): string
    {
        return $this->valeurCumulMillions;
    }

    public function getValeurCumulFcfa(): string
    {
        return $this->valeurCumulFcfa;
    }

    public function getValeurMoisFcfa(): string
    {
        return $this->valeurMoisFcfa;
    }

    public function getNiveau(): int
    {
        return $this->niveau;
    }

    public function getArchiveLe(): \DateTimeImmutable
    {
        return $this->archiveLe;
    }
}
