<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Entite\Referentiel;

use App\Module\ServiceOperationsFinancieres\Repository\CodeTofeRepository;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;

/**
 * Code TOFE (plan phase 0 — table code_tofe).
 * Clé primaire = code métier.
 */
#[ORM\Entity(repositoryClass: CodeTofeRepository::class)]
#[ORM\Table(name: 'sof_code_tofe')]
class CodeTofe
{
    #[ORM\Id]
    #[ORM\Column(name: 'code', type: Types::STRING, length: 32)]
    private string $code;

    #[ORM\Column(name: 'libelle', type: Types::STRING, length: 255)]
    private string $libelle;

    public function __construct(string $code, string $libelle)
    {
        $this->code = $code;
        $this->libelle = $libelle;
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
}
