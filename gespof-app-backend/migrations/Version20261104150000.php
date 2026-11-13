<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * SOF phase 0 : table code_tofe + seed maquette.
 */
final class Version20261104150000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'SOF : sof_code_tofe (code PK, libelle) + données initiales.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
            CREATE TABLE sof_code_tofe (
                code VARCHAR(32) NOT NULL,
                libelle VARCHAR(255) NOT NULL,
                PRIMARY KEY (code)
            )
        SQL);

        $lignes = [
            ['1.1.1', 'Recettes pétrolières'],
            ['1.1.2', 'Recettes fiscales'],
            ['1.1.3', 'Recettes non fiscales'],
            ['1.1.4', 'Recettes affectées'],
            ['2.1', 'Dépenses des exercices antérieurs'],
            ['2.2', "Dépenses de l'exercice"],
            ['3.2', 'Emprunts'],
            ['3.3', 'Recettes non budgétaires'],
        ];

        foreach ($lignes as [$code, $libelle]) {
            $this->addSql(
                'INSERT INTO sof_code_tofe (code, libelle) VALUES (?, ?)',
                [$code, $libelle],
            );
        }
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP TABLE sof_code_tofe');
    }
}
