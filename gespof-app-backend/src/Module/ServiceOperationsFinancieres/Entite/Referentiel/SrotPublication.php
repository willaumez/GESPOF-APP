<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Entite\Referentiel;

use App\Module\ServiceOperationsFinancieres\Entite\Periode;
use App\Module\ServiceOperationsFinancieres\Repository\SrotPublicationRepository;
use App\Shared\Entite\Utilisateur;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;

/**
 * Historique des publications SROT (SPEC §9 / §11).
 */
#[ORM\Entity(repositoryClass: SrotPublicationRepository::class)]
#[ORM\Table(name: 'sof_srot_publication')]
#[ORM\Index(name: 'idx_sof_srot_pub_periode', columns: ['periode_id'])]
#[ORM\Index(name: 'idx_sof_srot_pub_exercice', columns: ['exercice_annee'])]
class SrotPublication
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column(name: 'id', type: Types::INTEGER)]
    private ?int $id = null;

    #[ORM\ManyToOne(targetEntity: Periode::class)]
    #[ORM\JoinColumn(name: 'periode_id', referencedColumnName: 'id', nullable: false, onDelete: 'RESTRICT')]
    private Periode $periode;

    #[ORM\Column(name: 'exercice_annee', type: Types::INTEGER)]
    private int $exerciceAnnee;

    #[ORM\Column(name: 'mois', type: Types::INTEGER)]
    private int $mois;

    #[ORM\Column(name: 'version', type: Types::INTEGER)]
    private int $version;

    /** srot | execution | fiche_mbcp */
    #[ORM\Column(name: 'type_document', type: Types::STRING, length: 32)]
    private string $typeDocument = 'srot';

    #[ORM\Column(name: 'libelle', type: Types::STRING, length: 255)]
    private string $libelle;

    #[ORM\Column(name: 'composition', type: Types::JSON)]
    private array $composition = [];

    #[ORM\ManyToOne(targetEntity: Utilisateur::class)]
    #[ORM\JoinColumn(name: 'publie_par_id', referencedColumnName: 'id', nullable: true, onDelete: 'SET NULL')]
    private ?Utilisateur $publiePar = null;

    #[ORM\Column(name: 'publie_le', type: Types::DATETIME_IMMUTABLE)]
    private \DateTimeImmutable $publieLe;

    #[ORM\Column(name: 'motif_reouverture', type: Types::STRING, length: 500, nullable: true)]
    private ?string $motifReouverture = null;

    public function __construct(
        Periode $periode,
        int $version,
        string $libelle,
        array $composition = [],
        string $typeDocument = 'srot',
        ?Utilisateur $publiePar = null,
    ) {
        $this->periode = $periode;
        $this->exerciceAnnee = $periode->getExercice()->getAnnee();
        $this->mois = $periode->getMois();
        $this->version = $version;
        $this->libelle = $libelle;
        $this->composition = $composition;
        $this->typeDocument = $typeDocument;
        $this->publiePar = $publiePar;
        $this->publieLe = new \DateTimeImmutable();
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getPeriode(): Periode
    {
        return $this->periode;
    }

    public function getExerciceAnnee(): int
    {
        return $this->exerciceAnnee;
    }

    public function getMois(): int
    {
        return $this->mois;
    }

    public function getVersion(): int
    {
        return $this->version;
    }

    public function getTypeDocument(): string
    {
        return $this->typeDocument;
    }

    public function getLibelle(): string
    {
        return $this->libelle;
    }

    /**
     * @return array<string, mixed>
     */
    public function getComposition(): array
    {
        return $this->composition;
    }

    public function getPubliePar(): ?Utilisateur
    {
        return $this->publiePar;
    }

    public function getPublieLe(): \DateTimeImmutable
    {
        return $this->publieLe;
    }

    public function getMotifReouverture(): ?string
    {
        return $this->motifReouverture;
    }

    public function setMotifReouverture(?string $motif): static
    {
        $this->motifReouverture = $motif;

        return $this;
    }
}
