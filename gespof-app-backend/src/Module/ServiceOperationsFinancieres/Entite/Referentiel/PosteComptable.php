<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Entite\Referentiel;

use App\Module\ServiceOperationsFinancieres\Enum\CategoriePosteComptable;
use App\Module\ServiceOperationsFinancieres\Repository\PosteComptableRepository;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;

/**
 * Poste comptable (plan phase 0 — table poste_comptable).
 * Clé primaire = code métier (PC).
 */
#[ORM\Entity(repositoryClass: PosteComptableRepository::class)]
#[ORM\Table(name: 'sof_poste_comptable')]
#[ORM\Index(name: 'idx_sof_poste_comptable_categorie_defaut', columns: ['categorie_defaut'])]
class PosteComptable
{
    #[ORM\Id]
    #[ORM\Column(name: 'code', type: Types::STRING, length: 16)]
    private string $code;

    #[ORM\Column(name: 'libelle', type: Types::STRING, length: 255)]
    private string $libelle;

    /** Fallback si C_CATEG de la ligne est vide. */
    #[ORM\Column(name: 'categorie_defaut', type: Types::STRING, length: 8, enumType: CategoriePosteComptable::class)]
    private CategoriePosteComptable $categorieDefaut;

    /** Ex. ENT:5237|TPG:1273 — CSV reprise ou agrégat dernier lot RAP/XRAV. */
    #[ORM\Column(name: 'categories_observees', type: Types::STRING, length: 255, nullable: true)]
    private ?string $categoriesObservees = null;

    public function __construct(
        string $code,
        string $libelle,
        CategoriePosteComptable $categorieDefaut,
        ?string $categoriesObservees = null,
    ) {
        $this->code = $code;
        $this->libelle = $libelle;
        $this->categorieDefaut = $categorieDefaut;
        $this->categoriesObservees = $categoriesObservees !== null && trim($categoriesObservees) !== ''
            ? trim($categoriesObservees)
            : null;
    }

    public function getCode(): string
    {
        return $this->code;
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

    public function getCategorieDefaut(): CategoriePosteComptable
    {
        return $this->categorieDefaut;
    }

    /** @deprecated Alias de getCategorieDefaut() */
    public function getCategorie(): CategoriePosteComptable
    {
        return $this->categorieDefaut;
    }

    public function setCategorieDefaut(CategoriePosteComptable $categorieDefaut): static
    {
        $this->categorieDefaut = $categorieDefaut;

        return $this;
    }

    /** @deprecated Alias de setCategorieDefaut() */
    public function setCategorie(CategoriePosteComptable $categorie): static
    {
        return $this->setCategorieDefaut($categorie);
    }

    public function getCategoriesObservees(): ?string
    {
        return $this->categoriesObservees;
    }

    public function setCategoriesObservees(?string $categoriesObservees): static
    {
        $this->categoriesObservees = $categoriesObservees !== null && trim($categoriesObservees) !== ''
            ? trim($categoriesObservees)
            : null;

        return $this;
    }
}
