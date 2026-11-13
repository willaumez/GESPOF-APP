<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Entite\Referentiel;

use App\Module\ServiceOperationsFinancieres\Enum\StatutRapAnterieur;
use App\Module\ServiceOperationsFinancieres\Repository\RapAnterieurLigneRepository;
use App\Module\ServiceOperationsFinancieres\Support\Montant;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity(repositoryClass: RapAnterieurLigneRepository::class)]
#[ORM\Table(name: 'sof_rap_anterieur_ligne')]
#[ORM\Index(name: 'idx_sof_rap_anterieur_ligne_lot', columns: ['lot_id'])]
#[ORM\Index(name: 'idx_sof_rap_anterieur_ligne_ordo', columns: ['ordonnance'])]
class RapAnterieurLigne
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column(name: 'id', type: Types::INTEGER)]
    private ?int $id = null;

    #[ORM\ManyToOne(targetEntity: RapAnterieurLot::class, inversedBy: 'lignes')]
    #[ORM\JoinColumn(name: 'lot_id', referencedColumnName: 'id', nullable: false, onDelete: 'CASCADE')]
    private ?RapAnterieurLot $lot = null;

    #[ORM\Column(name: 'statut', type: Types::STRING, length: 16, enumType: StatutRapAnterieur::class)]
    private StatutRapAnterieur $statut;

    #[ORM\Column(name: 'echeance', type: Types::DATE_IMMUTABLE, nullable: true)]
    private ?\DateTimeImmutable $echeance = null;

    #[ORM\Column(name: 'exercice', type: Types::INTEGER)]
    private int $exercice;

    #[ORM\Column(name: 'ordonnance', type: Types::STRING, length: 64)]
    private string $ordonnance;

    #[ORM\Column(name: 'n_lig', type: Types::STRING, length: 32, nullable: true)]
    private ?string $nLig = null;

    #[ORM\Column(name: 'ministere', type: Types::STRING, length: 255, nullable: true)]
    private ?string $ministere = null;

    #[ORM\Column(name: 'titre', type: Types::STRING, length: 16, nullable: true)]
    private ?string $titre = null;

    #[ORM\Column(name: 'nature', type: Types::STRING, length: 32, nullable: true)]
    private ?string $nature = null;

    #[ORM\Column(name: 'beneficiaire', type: Types::STRING, length: 255, nullable: true)]
    private ?string $beneficiaire = null;

    #[ORM\Column(name: 'brut', type: Types::DECIMAL, precision: 20, scale: 2)]
    private string $brut = '0.00';

    #[ORM\Column(name: 'rap', type: Types::DECIMAL, precision: 20, scale: 2)]
    private string $rap = '0.00';

    #[ORM\Column(name: 'c_categ', type: Types::STRING, length: 16, nullable: true)]
    private ?string $cCateg = null;

    #[ORM\Column(name: 'poste', type: Types::STRING, length: 32, nullable: true)]
    private ?string $poste = null;

    /** @var array<string, mixed>|null */
    #[ORM\Column(name: 'payload', type: Types::JSON, nullable: true)]
    private ?array $payload = null;

    public function __construct(
        StatutRapAnterieur $statut,
        int $exercice,
        string $ordonnance,
        string $brut = '0.00',
        string $rap = '0.00',
    ) {
        $this->statut = $statut;
        $this->exercice = $exercice;
        $this->ordonnance = $ordonnance;
        $this->brut = Montant::normaliser($brut);
        $this->rap = Montant::normaliser($rap);
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getLot(): ?RapAnterieurLot
    {
        return $this->lot;
    }

    public function setLot(?RapAnterieurLot $lot): static
    {
        $this->lot = $lot;

        return $this;
    }

    public function getStatut(): StatutRapAnterieur
    {
        return $this->statut;
    }

    public function getEcheance(): ?\DateTimeImmutable
    {
        return $this->echeance;
    }

    public function setEcheance(?\DateTimeImmutable $echeance): static
    {
        $this->echeance = $echeance;

        return $this;
    }

    public function getExercice(): int
    {
        return $this->exercice;
    }

    public function getOrdonnance(): string
    {
        return $this->ordonnance;
    }

    public function getNLig(): ?string
    {
        return $this->nLig;
    }

    public function setNLig(?string $nLig): static
    {
        $this->nLig = $nLig;

        return $this;
    }

    public function getMinistere(): ?string
    {
        return $this->ministere;
    }

    public function setMinistere(?string $ministere): static
    {
        $this->ministere = $ministere;

        return $this;
    }

    public function getTitre(): ?string
    {
        return $this->titre;
    }

    public function setTitre(?string $titre): static
    {
        $this->titre = $titre;

        return $this;
    }

    public function getNature(): ?string
    {
        return $this->nature;
    }

    public function setNature(?string $nature): static
    {
        $this->nature = $nature;

        return $this;
    }

    public function getBeneficiaire(): ?string
    {
        return $this->beneficiaire;
    }

    public function setBeneficiaire(?string $beneficiaire): static
    {
        $this->beneficiaire = $beneficiaire;

        return $this;
    }

    public function getBrut(): string
    {
        return $this->brut;
    }

    public function getRap(): string
    {
        return $this->rap;
    }

    public function getCCateg(): ?string
    {
        return $this->cCateg;
    }

    public function setCCateg(?string $cCateg): static
    {
        $this->cCateg = $cCateg;

        return $this;
    }

    public function getPoste(): ?string
    {
        return $this->poste;
    }

    public function setPoste(?string $poste): static
    {
        $this->poste = $poste;

        return $this;
    }

    /** @return array<string, mixed>|null */
    public function getPayload(): ?array
    {
        return $this->payload;
    }

    /** @param array<string, mixed>|null $payload */
    public function setPayload(?array $payload): static
    {
        $this->payload = $payload;

        return $this;
    }
}
