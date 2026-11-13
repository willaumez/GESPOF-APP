<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * SOF Lot 6 : fiche de dépôts CUT (SPEC §8.3).
 */
final class Version20261113160000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'SOF Lot 6 : sof_fiche_depot_ligne';
    }

    public function up(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
            CREATE TABLE sof_fiche_depot_ligne (
                id SERIAL NOT NULL,
                exercice_annee INT NOT NULL,
                code VARCHAR(32) NOT NULL,
                categorie VARCHAR(32) NOT NULL,
                domiciliation VARCHAR(64) DEFAULT NULL,
                libelle VARCHAR(255) NOT NULL,
                devise VARCHAR(8) NOT NULL,
                montant_01_01 NUMERIC(20, 2) NOT NULL,
                montant_situation NUMERIC(20, 2) NOT NULL,
                ordre INT NOT NULL,
                PRIMARY KEY(id)
            )
        SQL);
        $this->addSql('CREATE UNIQUE INDEX uniq_sof_fiche_depot_ligne ON sof_fiche_depot_ligne (exercice_annee, code)');
        $this->addSql('CREATE INDEX idx_sof_fiche_depot_exercice ON sof_fiche_depot_ligne (exercice_annee)');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP TABLE sof_fiche_depot_ligne');
    }
}
