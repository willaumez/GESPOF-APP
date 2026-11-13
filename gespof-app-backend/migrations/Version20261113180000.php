<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/** SOF Lot 9 : commentaires fiche SROT + valeurs hors SROT TDB. */
final class Version20261113180000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'SOF Lot 9 : sof_rapport_commentaire + sof_hors_srot_valeur';
    }

    public function up(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
            CREATE TABLE sof_rapport_commentaire (
                id SERIAL NOT NULL,
                periode_id INT NOT NULL,
                cle VARCHAR(64) NOT NULL,
                texte TEXT NOT NULL,
                PRIMARY KEY(id)
            )
        SQL);
        $this->addSql('CREATE UNIQUE INDEX uniq_sof_rapport_commentaire ON sof_rapport_commentaire (periode_id, cle)');
        $this->addSql('ALTER TABLE sof_rapport_commentaire ADD CONSTRAINT fk_sof_rapport_com_periode FOREIGN KEY (periode_id) REFERENCES sof_periode (id) ON DELETE CASCADE NOT DEFERRABLE INITIALLY IMMEDIATE');

        $this->addSql(<<<'SQL'
            CREATE TABLE sof_hors_srot_valeur (
                id SERIAL NOT NULL,
                exercice_annee INT NOT NULL,
                mois SMALLINT NOT NULL,
                code VARCHAR(64) NOT NULL,
                valeur VARCHAR(64) NOT NULL,
                PRIMARY KEY(id)
            )
        SQL);
        $this->addSql('CREATE UNIQUE INDEX uniq_sof_hors_srot_valeur ON sof_hors_srot_valeur (exercice_annee, mois, code)');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE sof_rapport_commentaire DROP CONSTRAINT fk_sof_rapport_com_periode');
        $this->addSql('DROP TABLE sof_rapport_commentaire');
        $this->addSql('DROP TABLE sof_hors_srot_valeur');
    }
}
