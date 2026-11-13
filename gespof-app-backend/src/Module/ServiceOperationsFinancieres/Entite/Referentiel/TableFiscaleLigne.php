<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Entite\Referentiel;

use App\Module\ServiceOperationsFinancieres\Repository\TableFiscaleLigneRepository;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity(repositoryClass: TableFiscaleLigneRepository::class)]
#[ORM\Table(name: 'sof_table_fiscale_ligne')]
#[ORM\Index(name: 'idx_sof_table_fiscale_ligne_table', columns: ['table_code'])]
class TableFiscaleLigne
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column(name: 'id', type: Types::INTEGER)]
    private ?int $id = null;

    #[ORM\Column(name: 'table_code', type: Types::STRING, length: 16)]
    private string $tableCode;

    #[ORM\Column(name: 'nature', type: Types::STRING, length: 32)]
    private string $nature;

    #[ORM\Column(name: 'code_rf', type: Types::STRING, length: 32)]
    private string $codeRf;

    public function __construct(string $tableCode, string $nature, string $codeRf)
    {
        $this->tableCode = $tableCode;
        $this->nature = $nature;
        $this->codeRf = $codeRf;
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getTableCode(): string
    {
        return $this->tableCode;
    }

    public function setTableCode(string $tableCode): static
    {
        $this->tableCode = $tableCode;

        return $this;
    }

    public function getNature(): string
    {
        return $this->nature;
    }

    public function setNature(string $nature): static
    {
        $this->nature = $nature;

        return $this;
    }

    public function getCodeRf(): string
    {
        return $this->codeRf;
    }

    public function setCodeRf(string $codeRf): static
    {
        $this->codeRf = $codeRf;

        return $this;
    }
}
