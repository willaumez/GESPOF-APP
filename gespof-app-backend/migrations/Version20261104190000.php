<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * SOF phase 0 : table poste_comptable + seed maquette.
 */
final class Version20261104190000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'SOF : sof_poste_comptable (code PK, libelle, categorie) + données initiales.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
            CREATE TABLE sof_poste_comptable (
                code VARCHAR(16) NOT NULL,
                libelle VARCHAR(255) NOT NULL,
                categorie VARCHAR(8) NOT NULL,
                PRIMARY KEY (code)
            )
        SQL);
        $this->addSql(
            'CREATE INDEX idx_sof_poste_comptable_categorie ON sof_poste_comptable (categorie)',
        );

        $lignes = [
            ['TPG', 'Trésorerie Paierie Générale de Libreville', 'TPG'],
            ['PGP', 'Paierie de Port-Gentil', 'TPG'],
            ['PFV', 'Paierie de Franceville', 'TPG'],
            ['AGC', 'Agence comptable centrale', 'AGC'],
            ['ENT', 'Paierie des entreprises', 'ENT'],
        ];

        foreach ($lignes as [$code, $libelle, $categorie]) {
            $this->addSql(
                'INSERT INTO sof_poste_comptable (code, libelle, categorie) VALUES (?, ?, ?)',
                [$code, $libelle, $categorie],
            );
        }
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP TABLE sof_poste_comptable');
    }
}
