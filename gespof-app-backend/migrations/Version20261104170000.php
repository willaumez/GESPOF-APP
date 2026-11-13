<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * SOF phase 0 : table compte_suivi (douanes / pétrole) + seed maquette.
 */
final class Version20261104170000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'SOF : sof_compte_suivi (PK compte+nature) + index + données initiales.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
            CREATE TABLE sof_compte_suivi (
                compte VARCHAR(32) NOT NULL,
                nature VARCHAR(16) NOT NULL,
                libelle VARCHAR(255) NOT NULL,
                famille VARCHAR(16) NOT NULL,
                type VARCHAR(64) NOT NULL,
                bancaire_seulement BOOLEAN DEFAULT FALSE NOT NULL,
                ordre INT NOT NULL,
                PRIMARY KEY (compte, nature)
            )
        SQL);
        $this->addSql(
            'CREATE INDEX idx_sof_compte_suivi_famille_ordre ON sof_compte_suivi (famille, ordre)',
        );
        $this->addSql(
            'CREATE INDEX idx_sof_compte_suivi_type_ordre ON sof_compte_suivi (type, ordre)',
        );

        // Maquette ref-comptes (groupés par type) — natures 71+
        $lignes = [
            ['4784-101', '71', 'Douanes · recettes à crédit', 'DOUANE', 'À crédit', true, 1],
            ['4784-102', '72', 'Douanes · recettes à crédit Owendo', 'DOUANE', 'À crédit', true, 2],
            ['4784-201', '73', 'Douanes · comptant', 'DOUANE', 'Au comptant', false, 3],
            ['4784-31', '74', 'Douanes · manuelle', 'DOUANE', 'Au comptant', false, 4],
            ['4781-11', '75', 'Pétrole · RMP', 'PETROLE', 'RMP', false, 5],
            ['4781-12', '76', 'Pétrole · IS', 'PETROLE', 'IS', false, 6],
            ['4783-1', '77', 'Pétrole · dividendes', 'PETROLE', 'Dividendes', false, 7],
        ];

        foreach ($lignes as [$compte, $nature, $libelle, $famille, $type, $bancaire, $ordre]) {
            $bancaireSql = $bancaire ? 'TRUE' : 'FALSE';
            $this->addSql(
                "INSERT INTO sof_compte_suivi (compte, nature, libelle, famille, type, bancaire_seulement, ordre)
                 VALUES (?, ?, ?, ?, ?, {$bancaireSql}, ?)",
                [$compte, $nature, $libelle, $famille, $type, $ordre],
            );
        }
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP TABLE sof_compte_suivi');
    }
}
