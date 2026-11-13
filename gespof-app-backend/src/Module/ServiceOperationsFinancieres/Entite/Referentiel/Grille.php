<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Entite\Referentiel;

use App\Module\ServiceOperationsFinancieres\Enum\TypeGrille;
use App\Module\ServiceOperationsFinancieres\Repository\GrilleRepository;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity(repositoryClass: GrilleRepository::class)]
#[ORM\Table(name: 'sof_grille')]
#[ORM\UniqueConstraint(name: 'uniq_sof_grille_exercice_type', columns: ['exercice_annee', 'type'])]
#[ORM\Index(name: 'idx_sof_grille_type_ex', columns: ['type', 'exercice_annee'])]
class Grille
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column(name: 'id', type: Types::INTEGER)]
    private ?int $id = null;

    #[ORM\Column(name: 'exercice_annee', type: Types::INTEGER)]
    private int $exerciceAnnee;

    #[ORM\Column(name: 'periode_id', type: Types::INTEGER, nullable: true)]
    private ?int $periodeId = null;

    #[ORM\Column(name: 'type', type: Types::STRING, length: 32, enumType: TypeGrille::class)]
    private TypeGrille $type;

    /** Unité d'import source (MILLIONS | FCFA) — stockage des valeurs toujours en FCFA. */
    #[ORM\Column(name: 'unite_saisie', type: Types::STRING, length: 16)]
    private string $uniteSaisie = 'FCFA';

    #[ORM\Column(name: 'lot_id', type: Types::INTEGER, nullable: true)]
    private ?int $lotId = null;

    /**
     * @var Collection<int, GrilleLigne>
     */
    #[ORM\OneToMany(targetEntity: GrilleLigne::class, mappedBy: 'grille', cascade: ['persist', 'remove'], orphanRemoval: true)]
    #[ORM\OrderBy(['ordre' => 'ASC', 'id' => 'ASC'])]
    private Collection $lignes;

    public function __construct(int $exerciceAnnee, TypeGrille $type, ?string $uniteSaisie = null)
    {
        $this->exerciceAnnee = $exerciceAnnee;
        $this->type = $type;
        $this->uniteSaisie = $uniteSaisie ?? $type->uniteImportDefaut();
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

    public function getPeriodeId(): ?int
    {
        return $this->periodeId;
    }

    public function setPeriodeId(?int $periodeId): static
    {
        $this->periodeId = $periodeId;

        return $this;
    }

    public function getType(): TypeGrille
    {
        return $this->type;
    }

    public function getUniteSaisie(): string
    {
        return $this->uniteSaisie;
    }

    public function setUniteSaisie(string $uniteSaisie): static
    {
        $this->uniteSaisie = $uniteSaisie;

        return $this;
    }

    public function getLotId(): ?int
    {
        return $this->lotId;
    }

    public function setLotId(?int $lotId): static
    {
        $this->lotId = $lotId;

        return $this;
    }

    /**
     * @return Collection<int, GrilleLigne>
     */
    public function getLignes(): Collection
    {
        return $this->lignes;
    }

    public function ajouterLigne(GrilleLigne $ligne): static
    {
        if (!$this->lignes->contains($ligne)) {
            $this->lignes->add($ligne);
            $ligne->setGrille($this);
        }

        return $this;
    }
}
