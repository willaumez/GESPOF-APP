<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Entite\Referentiel;

use App\Module\ServiceOperationsFinancieres\Repository\RapAnterieurLotRepository;
use App\Module\ServiceOperationsFinancieres\Support\Montant;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity(repositoryClass: RapAnterieurLotRepository::class)]
#[ORM\Table(name: 'sof_rap_anterieur_lot')]
#[ORM\Index(name: 'idx_sof_rap_anterieur_lot_ex', columns: ['exercice_annee'])]
class RapAnterieurLot
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column(name: 'id', type: Types::INTEGER)]
    private ?int $id = null;

    #[ORM\Column(name: 'exercice_annee', type: Types::INTEGER)]
    private int $exerciceAnnee;

    #[ORM\Column(name: 'importe_le', type: Types::DATETIME_IMMUTABLE)]
    private \DateTimeImmutable $importeLe;

    #[ORM\Column(name: 'nb_lignes', type: Types::INTEGER)]
    private int $nbLignes = 0;

    #[ORM\Column(name: 'total_brut', type: Types::DECIMAL, precision: 20, scale: 2)]
    private string $totalBrut = '0.00';

    #[ORM\Column(name: 'total_rap', type: Types::DECIMAL, precision: 20, scale: 2)]
    private string $totalRap = '0.00';

    #[ORM\Column(name: 'fichier', type: Types::STRING, length: 255, nullable: true)]
    private ?string $fichier = null;

    /** @var Collection<int, RapAnterieurLigne> */
    #[ORM\OneToMany(targetEntity: RapAnterieurLigne::class, mappedBy: 'lot', cascade: ['persist', 'remove'], orphanRemoval: true)]
    private Collection $lignes;

    public function __construct(int $exerciceAnnee, ?string $fichier = null)
    {
        $this->exerciceAnnee = $exerciceAnnee;
        $this->importeLe = new \DateTimeImmutable();
        $this->fichier = $fichier;
        $this->lignes = new ArrayCollection();
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getExerciceAnnee(): int
    {
        return $this->exerciceAnnee;
    }

    public function getImporteLe(): \DateTimeImmutable
    {
        return $this->importeLe;
    }

    public function getNbLignes(): int
    {
        return $this->nbLignes;
    }

    public function getTotalBrut(): string
    {
        return $this->totalBrut;
    }

    public function getTotalRap(): string
    {
        return $this->totalRap;
    }

    public function getFichier(): ?string
    {
        return $this->fichier;
    }

    /** @return Collection<int, RapAnterieurLigne> */
    public function getLignes(): Collection
    {
        return $this->lignes;
    }

    public function ajouterLigne(RapAnterieurLigne $ligne): static
    {
        if (!$this->lignes->contains($ligne)) {
            $this->lignes->add($ligne);
            $ligne->setLot($this);
            $this->nbLignes = $this->lignes->count();
            $this->totalBrut = Montant::additionner($this->totalBrut, $ligne->getBrut());
            $this->totalRap = Montant::additionner($this->totalRap, $ligne->getRap());
        }

        return $this;
    }

    public function recalculerTotaux(): void
    {
        $brut = '0.00';
        $rap = '0.00';
        foreach ($this->lignes as $l) {
            $brut = Montant::additionner($brut, $l->getBrut());
            $rap = Montant::additionner($rap, $l->getRap());
        }
        $this->nbLignes = $this->lignes->count();
        $this->totalBrut = $brut;
        $this->totalRap = $rap;
    }
}
