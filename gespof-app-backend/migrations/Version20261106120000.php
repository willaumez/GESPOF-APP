<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261106120000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'SOF : extraction_lancement + extraction_element (suivi progressif DC/IG)';
    }

    public function up(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
            CREATE TABLE sof_extraction_lancement (
                id SERIAL NOT NULL,
                periode_id INT NOT NULL,
                exercice INT NOT NULL,
                date_situation DATE NOT NULL,
                statut VARCHAR(16) NOT NULL DEFAULT 'EN_COURS',
                pourcentage INT NOT NULL DEFAULT 0,
                lance_par_id INT DEFAULT NULL,
                debut TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                fin TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL,
                PRIMARY KEY (id),
                CONSTRAINT fk_sof_ext_lanc_periode FOREIGN KEY (periode_id)
                    REFERENCES sof_periode (id) ON DELETE CASCADE
            )
        SQL);
        $this->addSql('CREATE INDEX idx_sof_ext_lanc_periode ON sof_extraction_lancement (periode_id)');
        $this->addSql('CREATE INDEX idx_sof_ext_lanc_statut ON sof_extraction_lancement (statut)');

        $this->addSql(<<<'SQL'
            CREATE TABLE sof_extraction_element (
                id SERIAL NOT NULL,
                lancement_id INT NOT NULL,
                parent_id INT DEFAULT NULL,
                ordre INT NOT NULL DEFAULT 0,
                code_preset VARCHAR(64) DEFAULT NULL,
                compte VARCHAR(32) DEFAULT NULL,
                nature VARCHAR(16) DEFAULT NULL,
                titre VARCHAR(255) NOT NULL,
                statut VARCHAR(16) NOT NULL DEFAULT 'EN_ATTENTE',
                lignes_traitees INT DEFAULT NULL,
                lignes_a_extraire INT DEFAULT NULL,
                pourcentage INT NOT NULL DEFAULT 0,
                message VARCHAR(500) DEFAULT NULL,
                lot_id INT DEFAULT NULL,
                debut TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL,
                fin TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL,
                PRIMARY KEY (id),
                CONSTRAINT fk_sof_ext_el_lanc FOREIGN KEY (lancement_id)
                    REFERENCES sof_extraction_lancement (id) ON DELETE CASCADE,
                CONSTRAINT fk_sof_ext_el_parent FOREIGN KEY (parent_id)
                    REFERENCES sof_extraction_element (id) ON DELETE CASCADE
            )
        SQL);
        $this->addSql('CREATE INDEX idx_sof_ext_el_lanc ON sof_extraction_element (lancement_id)');
        $this->addSql('CREATE INDEX idx_sof_ext_el_statut ON sof_extraction_element (lancement_id, statut)');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP TABLE sof_extraction_element');
        $this->addSql('DROP TABLE sof_extraction_lancement');
    }
}
