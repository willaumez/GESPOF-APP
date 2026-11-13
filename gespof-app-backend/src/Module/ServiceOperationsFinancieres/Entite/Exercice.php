<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Entite;

use App\Module\ServiceOperationsFinancieres\Entite\Recette\Recette;
use App\Module\ServiceOperationsFinancieres\Enum\LoiEnVigueur;
use App\Module\ServiceOperationsFinancieres\Enum\StatutExercice;
use App\Module\ServiceOperationsFinancieres\Repository\ExerciceRepository;
use App\Module\ServiceOperationsFinancieres\Support\Montant;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;

/**
 * Exercice budgétaire SOF.
 * Clé primaire = année (clé métier).
 *
 * @see Plan SOF — table exercice (annee, balance_initiale, loi_en_vigueur,
 *      prefixe_ad, delai_arriere_jours, statut)
 */
#[ORM\Entity(repositoryClass: ExerciceRepository::class)]
#[ORM\Table(name: 'sof_exercice')]
class Exercice
{
    #[ORM\Id]
    #[ORM\Column(name: 'annee', type: Types::INTEGER)]
    private int $annee;

    /** FCFA : jusqu'à 10^18 (précision 20,2) pour les soldes du Trésor. */
    #[ORM\Column(name: 'balance_initiale', type: Types::DECIMAL, precision: 20, scale: 2)]
    private string $balanceInitiale;

    #[ORM\Column(name: 'loi_en_vigueur', type: Types::STRING, length: 8, nullable: true, enumType: LoiEnVigueur::class)]
    private ?LoiEnVigueur $loiEnVigueur = null;

    /** 2 premiers chiffres du n° d'AD (C_REF1), 0–99. */
    #[ORM\Column(name: 'prefixe_ad', type: Types::SMALLINT)]
    private int $prefixeAd;

    #[ORM\Column(name: 'delai_arriere_jours', type: Types::INTEGER)]
    private int $delaiArriereJours;

    #[ORM\Column(name: 'statut', type: Types::STRING, length: 16, enumType: StatutExercice::class)]
    private StatutExercice $statut;

    #[ORM\Column(name: 'date_ouverture', type: Types::DATE_IMMUTABLE, nullable: true)]
    private ?\DateTimeImmutable $dateOuverture = null;

    #[ORM\Column(name: 'date_cloture', type: Types::DATE_IMMUTABLE, nullable: true)]
    private ?\DateTimeImmutable $dateCloture = null;

    /**
     * @var Collection<int, Recette>
     */
    #[ORM\OneToMany(targetEntity: Recette::class, mappedBy: 'exercice')]
    private Collection $recettes;

    /**
     * @var Collection<int, Depense>
     */
    #[ORM\OneToMany(targetEntity: Depense::class, mappedBy: 'exercice')]
    private Collection $depenses;

    public function __construct(
        int $annee,
        string $balanceInitiale = '0.00',
        ?LoiEnVigueur $loiEnVigueur = LoiEnVigueur::LFI,
        int|string|null $prefixeAd = null,
        int $delaiArriereJours = 90,
        StatutExercice $statut = StatutExercice::OUVERT,
        ?\DateTimeImmutable $dateOuverture = null,
    ) {
        $this->annee = $annee;
        $this->balanceInitiale = Montant::normaliser($balanceInitiale);
        $this->loiEnVigueur = $loiEnVigueur;
        $this->prefixeAd = self::normaliserPrefixeAd($prefixeAd, $annee);
        $this->delaiArriereJours = $delaiArriereJours;
        $this->statut = $statut;
        $this->dateOuverture = $dateOuverture ?? new \DateTimeImmutable(sprintf('%d-01-02', $annee));
        $this->recettes = new ArrayCollection();
        $this->depenses = new ArrayCollection();
    }

    public function getAnnee(): int
    {
        return $this->annee;
    }

    public function getBalanceInitiale(): string
    {
        return $this->balanceInitiale;
    }

    public function setBalanceInitiale(string $balanceInitiale): static
    {
        $this->balanceInitiale = Montant::normaliser($balanceInitiale);

        return $this;
    }

    /** @deprecated Alias de getBalanceInitiale() — conserver pour appels historiques. */
    public function getSoldeOuverture(): string
    {
        return $this->getBalanceInitiale();
    }

    public function getLoiEnVigueur(): ?LoiEnVigueur
    {
        return $this->loiEnVigueur;
    }

    public function setLoiEnVigueur(?LoiEnVigueur $loiEnVigueur): static
    {
        $this->loiEnVigueur = $loiEnVigueur;

        return $this;
    }

    public function getPrefixeAd(): int
    {
        return $this->prefixeAd;
    }

    public function setPrefixeAd(int|string $prefixeAd): static
    {
        $this->prefixeAd = self::normaliserPrefixeAd($prefixeAd, $this->annee);

        return $this;
    }

    public static function normaliserPrefixeAd(int|string|null $prefixeAd, int $annee): int
    {
        if ($prefixeAd === null || $prefixeAd === '') {
            return $annee % 100;
        }
        if (is_int($prefixeAd)) {
            return max(0, min(99, $prefixeAd));
        }
        $chiffres = preg_replace('/\D+/', '', trim($prefixeAd)) ?? '';
        if ($chiffres === '') {
            return $annee % 100;
        }

        return max(0, min(99, (int) $chiffres % 100));
    }

    public function getDelaiArriereJours(): int
    {
        return $this->delaiArriereJours;
    }

    public function setDelaiArriereJours(int $delaiArriereJours): static
    {
        $this->delaiArriereJours = $delaiArriereJours;

        return $this;
    }

    public function getStatut(): StatutExercice
    {
        return $this->statut;
    }

    public function getDateOuverture(): ?\DateTimeImmutable
    {
        return $this->dateOuverture;
    }

    public function getDateCloture(): ?\DateTimeImmutable
    {
        return $this->dateCloture;
    }

    public function estOuvert(): bool
    {
        return $this->statut === StatutExercice::OUVERT;
    }

    public function cloturer(?\DateTimeImmutable $date = null): static
    {
        $this->statut = StatutExercice::CLOTURE;
        $this->dateCloture = $date ?? new \DateTimeImmutable('today');

        return $this;
    }

    /**
     * @return Collection<int, Recette>
     */
    public function getRecettes(): Collection
    {
        return $this->recettes;
    }

    public function addRecette(Recette $recette): static
    {
        if (!$this->recettes->contains($recette)) {
            $this->recettes->add($recette);
        }

        return $this;
    }

    /**
     * @return Collection<int, Depense>
     */
    public function getDepenses(): Collection
    {
        return $this->depenses;
    }

    public function addDepense(Depense $depense): static
    {
        if (!$this->depenses->contains($depense)) {
            $this->depenses->add($depense);
        }

        return $this;
    }

    /** Libellé statut maquette : « Ouvert depuis le 02/01/2026 ». */
    public function libelleStatut(): string
    {
        if ($this->statut === StatutExercice::CLOTURE) {
            $date = $this->dateCloture?->format('d/m/Y');

            return $date ? sprintf('Clôturé le %s', $date) : 'Clôturé';
        }

        $date = $this->dateOuverture?->format('d/m/Y');

        return $date ? sprintf('Ouvert depuis le %s', $date) : 'Ouvert';
    }
}
