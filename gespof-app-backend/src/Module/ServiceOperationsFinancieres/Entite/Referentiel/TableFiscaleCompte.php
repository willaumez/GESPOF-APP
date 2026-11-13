<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Entite\Referentiel;

use App\Module\ServiceOperationsFinancieres\Repository\TableFiscaleCompteRepository;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity(repositoryClass: TableFiscaleCompteRepository::class)]
#[ORM\Table(name: 'sof_table_fiscale_compte')]
class TableFiscaleCompte
{
    #[ORM\Id]
    #[ORM\Column(name: 'compte', type: Types::STRING, length: 32)]
    private string $compte;

    #[ORM\Column(name: 'table_code', type: Types::STRING, length: 16)]
    private string $tableCode;

    public function __construct(string $compte, string $tableCode)
    {
        $this->compte = $compte;
        $this->tableCode = $tableCode;
    }

    public function getCompte(): string
    {
        return $this->compte;
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
}
