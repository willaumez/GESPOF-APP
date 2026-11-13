<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Entite\Referentiel;

use App\Module\ServiceOperationsFinancieres\Repository\FicheDepotLigneRepository;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;

/**
 * Ligne de la Fiche de dépôts CUT (SPEC §8.3) — saisie Chef SOF.
 */
#[ORM\Entity(repositoryClass: FicheDepotLigneRepository::class)]
#[ORM\Table(name: 'sof_fiche_depot_ligne')]
#[ORM\UniqueConstraint(
    name: 'uniq_sof_fiche_depot_ligne',
    columns: ['exercice_annee', 'code'],
)]
#[ORM\Index(name: 'idx_sof_fiche_depot_exercice', columns: ['exercice_annee'])]
class FicheDepotLigne
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column(name: 'id', type: Types::INTEGER)]
    private ?int $id = null;

    #[ORM\Column(name: 'exercice_annee', type: Types::INTEGER)]
    private int $exerciceAnnee;

    /** Identifiant stable (CUT01, POSTE01, CHEQ, CITI, TOIS1…). */
    #[ORM\Column(name: 'code', type: Types::STRING, length: 32)]
    private string $code;

    /** compte | poste | cheque | citi | tresorerie_oisive */
    #[ORM\Column(name: 'categorie', type: Types::STRING, length: 32)]
    private string $categorie;

    #[ORM\Column(name: 'domiciliation', type: Types::STRING, length: 64, nullable: true)]
    private ?string $domiciliation = null;

    #[ORM\Column(name: 'libelle', type: Types::STRING, length: 255)]
    private string $libelle;

    #[ORM\Column(name: 'devise', type: Types::STRING, length: 8)]
    private string $devise = 'XAF';

    #[ORM\Column(name: 'montant_01_01', type: Types::DECIMAL, precision: 20, scale: 2)]
    private string $montant0101 = '0.00';

    #[ORM\Column(name: 'montant_situation', type: Types::DECIMAL, precision: 20, scale: 2)]
    private string $montantSituation = '0.00';

    #[ORM\Column(name: 'ordre', type: Types::INTEGER)]
    private int $ordre = 0;

    public function __construct(
        int $exerciceAnnee,
        string $code,
        string $categorie,
        string $libelle,
        string $devise = 'XAF',
        ?string $domiciliation = null,
        int $ordre = 0,
    ) {
        $this->exerciceAnnee = $exerciceAnnee;
        $this->code = $code;
        $this->categorie = $categorie;
        $this->libelle = $libelle;
        $this->devise = $devise;
        $this->domiciliation = $domiciliation;
        $this->ordre = $ordre;
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getExerciceAnnee(): int
    {
        return $this->exerciceAnnee;
    }

    public function getCode(): string
    {
        return $this->code;
    }

    public function getCategorie(): string
    {
        return $this->categorie;
    }

    public function getDomiciliation(): ?string
    {
        return $this->domiciliation;
    }

    public function setDomiciliation(?string $domiciliation): static
    {
        $this->domiciliation = $domiciliation;

        return $this;
    }

    public function getLibelle(): string
    {
        return $this->libelle;
    }

    public function setLibelle(string $libelle): static
    {
        $this->libelle = $libelle;

        return $this;
    }

    public function getDevise(): string
    {
        return $this->devise;
    }

    public function setDevise(string $devise): static
    {
        $this->devise = $devise;

        return $this;
    }

    public function getMontant0101(): string
    {
        return $this->montant0101;
    }

    public function setMontant0101(string $montant): static
    {
        $this->montant0101 = $montant;

        return $this;
    }

    public function getMontantSituation(): string
    {
        return $this->montantSituation;
    }

    public function setMontantSituation(string $montant): static
    {
        $this->montantSituation = $montant;

        return $this;
    }

    public function getOrdre(): int
    {
        return $this->ordre;
    }
}
