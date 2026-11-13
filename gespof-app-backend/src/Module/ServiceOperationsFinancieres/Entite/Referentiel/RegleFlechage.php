<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Entite\Referentiel;

use App\Module\ServiceOperationsFinancieres\Enum\DomaineFlechage;
use App\Module\ServiceOperationsFinancieres\Repository\RegleFlechageRepository;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;

/**
 * Règle de fléchage (plan phase 0 — table regle_flechage).
 * Critère vide (null) = toute valeur.
 */
#[ORM\Entity(repositoryClass: RegleFlechageRepository::class)]
#[ORM\Table(name: 'sof_regle_flechage')]
#[ORM\Index(name: 'idx_sof_regle_flechage_domaine_priorite', columns: ['domaine', 'priorite'])]
class RegleFlechage
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column(name: 'id', type: Types::INTEGER)]
    private ?int $id = null;

    #[ORM\Column(name: 'domaine', type: Types::STRING, length: 32, enumType: DomaineFlechage::class)]
    private DomaineFlechage $domaine;

    #[ORM\Column(name: 'categorie', type: Types::STRING, length: 64, nullable: true)]
    private ?string $categorie = null;

    #[ORM\Column(name: 'compte', type: Types::STRING, length: 32, nullable: true)]
    private ?string $compte = null;

    #[ORM\Column(name: 'nature', type: Types::STRING, length: 32, nullable: true)]
    private ?string $nature = null;

    #[ORM\Column(name: 'type_exercice', type: Types::STRING, length: 32, nullable: true)]
    private ?string $typeExercice = null;

    #[ORM\Column(name: 'titre', type: Types::STRING, length: 16, nullable: true)]
    private ?string $titre = null;

    #[ORM\Column(name: 'mdr', type: Types::STRING, length: 16, nullable: true)]
    private ?string $mdr = null;

    #[ORM\Column(name: 'rubrique_code', type: Types::STRING, length: 16)]
    private string $rubriqueCode;

    #[ORM\Column(name: 'titre_resultat', type: Types::STRING, length: 16, nullable: true)]
    private ?string $titreResultat = null;

    #[ORM\Column(name: 'priorite', type: Types::INTEGER)]
    private int $priorite = 1;

    #[ORM\Column(name: 'valide_du', type: Types::DATE_IMMUTABLE, nullable: true)]
    private ?\DateTimeImmutable $valideDu = null;

    #[ORM\Column(name: 'valide_au', type: Types::DATE_IMMUTABLE, nullable: true)]
    private ?\DateTimeImmutable $valideAu = null;

    public function __construct(
        DomaineFlechage $domaine,
        string $rubriqueCode,
        int $priorite = 1,
    ) {
        $this->domaine = $domaine;
        $this->rubriqueCode = $rubriqueCode;
        $this->priorite = $priorite;
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getDomaine(): DomaineFlechage
    {
        return $this->domaine;
    }

    public function setDomaine(DomaineFlechage $domaine): static
    {
        $this->domaine = $domaine;

        return $this;
    }

    public function getCategorie(): ?string
    {
        return $this->categorie;
    }

    public function setCategorie(?string $categorie): static
    {
        $this->categorie = self::videVersNull($categorie);

        return $this;
    }

    public function getCompte(): ?string
    {
        return $this->compte;
    }

    public function setCompte(?string $compte): static
    {
        $this->compte = self::videVersNull($compte);

        return $this;
    }

    public function getNature(): ?string
    {
        return $this->nature;
    }

    public function setNature(?string $nature): static
    {
        $this->nature = self::videVersNull($nature);

        return $this;
    }

    public function getTypeExercice(): ?string
    {
        return $this->typeExercice;
    }

    public function setTypeExercice(?string $typeExercice): static
    {
        $this->typeExercice = self::videVersNull($typeExercice);

        return $this;
    }

    public function getTitre(): ?string
    {
        return $this->titre;
    }

    public function setTitre(?string $titre): static
    {
        $this->titre = self::videVersNull($titre);

        return $this;
    }

    public function getMdr(): ?string
    {
        return $this->mdr;
    }

    public function setMdr(?string $mdr): static
    {
        $this->mdr = self::videVersNull($mdr);

        return $this;
    }

    public function getRubriqueCode(): string
    {
        return $this->rubriqueCode;
    }

    public function setRubriqueCode(string $rubriqueCode): static
    {
        $this->rubriqueCode = $rubriqueCode;

        return $this;
    }

    public function getTitreResultat(): ?string
    {
        return $this->titreResultat;
    }

    public function setTitreResultat(?string $titreResultat): static
    {
        $this->titreResultat = self::videVersNull($titreResultat);

        return $this;
    }

    public function getPriorite(): int
    {
        return $this->priorite;
    }

    public function setPriorite(int $priorite): static
    {
        $this->priorite = $priorite;

        return $this;
    }

    public function getValideDu(): ?\DateTimeImmutable
    {
        return $this->valideDu;
    }

    public function setValideDu(?\DateTimeImmutable $valideDu): static
    {
        $this->valideDu = $valideDu;

        return $this;
    }

    public function getValideAu(): ?\DateTimeImmutable
    {
        return $this->valideAu;
    }

    public function setValideAu(?\DateTimeImmutable $valideAu): static
    {
        $this->valideAu = $valideAu;

        return $this;
    }

    private static function videVersNull(?string $v): ?string
    {
        if ($v === null) {
            return null;
        }
        $t = trim($v);

        return $t === '' || $t === '—' ? null : $t;
    }
}
