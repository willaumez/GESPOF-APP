<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * SOF Lot 7 : srot_archive + srot_publication (SPEC §9).
 */
final class Version20261113170000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'SOF Lot 7 : sof_srot_archive + sof_srot_publication';
    }

    public function up(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
            CREATE TABLE sof_srot_archive (
                id SERIAL NOT NULL,
                exercice_annee INT NOT NULL,
                mois INT NOT NULL,
                ligne_srot VARCHAR(32) NOT NULL,
                libelle VARCHAR(255) NOT NULL,
                valeur_cumul_millions NUMERIC(24, 6) NOT NULL,
                valeur_cumul_fcfa NUMERIC(20, 2) NOT NULL,
                valeur_mois_fcfa NUMERIC(20, 2) NOT NULL,
                niveau SMALLINT NOT NULL,
                archive_le TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                PRIMARY KEY(id)
            )
        SQL);
        $this->addSql('CREATE UNIQUE INDEX uniq_sof_srot_archive ON sof_srot_archive (exercice_annee, mois, ligne_srot)');
        $this->addSql('CREATE INDEX idx_sof_srot_archive_exercice_mois ON sof_srot_archive (exercice_annee, mois)');

        $this->addSql(<<<'SQL'
            CREATE TABLE sof_srot_publication (
                id SERIAL NOT NULL,
                periode_id INT NOT NULL,
                exercice_annee INT NOT NULL,
                mois INT NOT NULL,
                version INT NOT NULL,
                type_document VARCHAR(32) NOT NULL,
                libelle VARCHAR(255) NOT NULL,
                composition JSON NOT NULL,
                publie_par_id INT DEFAULT NULL,
                publie_le TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                motif_reouverture VARCHAR(500) DEFAULT NULL,
                PRIMARY KEY(id)
            )
        SQL);
        $this->addSql('CREATE INDEX idx_sof_srot_pub_periode ON sof_srot_publication (periode_id)');
        $this->addSql('CREATE INDEX idx_sof_srot_pub_exercice ON sof_srot_publication (exercice_annee)');
        $this->addSql('ALTER TABLE sof_srot_publication ADD CONSTRAINT fk_sof_srot_pub_periode FOREIGN KEY (periode_id) REFERENCES sof_periode (id) ON DELETE RESTRICT NOT DEFERRABLE INITIALLY IMMEDIATE');
        $this->addSql('ALTER TABLE sof_srot_publication ADD CONSTRAINT fk_sof_srot_pub_user FOREIGN KEY (publie_par_id) REFERENCES utilisateur (id) ON DELETE SET NULL NOT DEFERRABLE INITIALLY IMMEDIATE');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE sof_srot_publication DROP CONSTRAINT fk_sof_srot_pub_periode');
        $this->addSql('ALTER TABLE sof_srot_publication DROP CONSTRAINT fk_sof_srot_pub_user');
        $this->addSql('DROP TABLE sof_srot_publication');
        $this->addSql('DROP TABLE sof_srot_archive');
    }
}
