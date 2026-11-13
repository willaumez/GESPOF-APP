<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * SOF phases 0 gaps + 4 : tables fiscales, exclusions RAP, grilles mensuelles.
 */
final class Version20261105180000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'SOF : sof_table_fiscale_compte, sof_table_fiscale_ligne, sof_exclusion_rap, sof_grille (+ ligne/valeur)';
    }

    public function up(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
            CREATE TABLE sof_table_fiscale_compte (
                compte VARCHAR(32) NOT NULL,
                table_code VARCHAR(16) NOT NULL,
                PRIMARY KEY (compte)
            )
        SQL);

        $this->addSql(<<<'SQL'
            CREATE TABLE sof_table_fiscale_ligne (
                id SERIAL NOT NULL,
                table_code VARCHAR(16) NOT NULL,
                nature VARCHAR(32) NOT NULL,
                code_rf VARCHAR(32) NOT NULL,
                PRIMARY KEY (id)
            )
        SQL);
        $this->addSql('CREATE INDEX idx_sof_table_fiscale_ligne_table ON sof_table_fiscale_ligne (table_code)');

        $this->addSql(<<<'SQL'
            CREATE TABLE sof_exclusion_rap (
                id SERIAL NOT NULL,
                type VARCHAR(16) NOT NULL,
                code VARCHAR(64) NOT NULL,
                libelle VARCHAR(255) DEFAULT NULL,
                motif VARCHAR(500) DEFAULT NULL,
                date_exclusion DATE DEFAULT NULL,
                auteur VARCHAR(128) DEFAULT NULL,
                PRIMARY KEY (id)
            )
        SQL);
        $this->addSql('CREATE INDEX idx_sof_exclusion_rap_type ON sof_exclusion_rap (type)');

        $this->addSql(<<<'SQL'
            CREATE TABLE sof_grille (
                id SERIAL NOT NULL,
                exercice_annee INT NOT NULL,
                periode_id INT DEFAULT NULL,
                type VARCHAR(32) NOT NULL,
                unite_saisie VARCHAR(16) NOT NULL DEFAULT 'FCFA',
                lot_id INT DEFAULT NULL,
                PRIMARY KEY (id)
            )
        SQL);
        $this->addSql('CREATE INDEX idx_sof_grille_type_ex ON sof_grille (type, exercice_annee)');

        $this->addSql(<<<'SQL'
            CREATE TABLE sof_grille_ligne (
                id SERIAL NOT NULL,
                grille_id INT NOT NULL,
                code VARCHAR(64) DEFAULT NULL,
                libelle VARCHAR(255) NOT NULL,
                ordre INT NOT NULL DEFAULT 0,
                rubrique_code VARCHAR(32) DEFAULT NULL,
                PRIMARY KEY (id),
                CONSTRAINT fk_sof_grille_ligne_grille FOREIGN KEY (grille_id) REFERENCES sof_grille (id) ON DELETE CASCADE
            )
        SQL);

        $this->addSql(<<<'SQL'
            CREATE TABLE sof_grille_valeur (
                id SERIAL NOT NULL,
                grille_ligne_id INT NOT NULL,
                mois SMALLINT NOT NULL,
                montant NUMERIC(20, 2) NOT NULL DEFAULT 0,
                PRIMARY KEY (id),
                CONSTRAINT fk_sof_grille_valeur_ligne FOREIGN KEY (grille_ligne_id) REFERENCES sof_grille_ligne (id) ON DELETE CASCADE,
                CONSTRAINT uq_sof_grille_valeur_ligne_mois UNIQUE (grille_ligne_id, mois)
            )
        SQL);

        // Données initiales tables fiscales (maquette)
        foreach (
            [
                ['1812-101', 'T1'],
                ['4781-31', 'T2'],
                ['4781-11', 'T3'],
                ['4783-1', 'T4'],
            ] as [$compte, $table]
        ) {
            $this->addSql(
                'INSERT INTO sof_table_fiscale_compte (compte, table_code) VALUES (?, ?)',
                [$compte, $table],
            );
        }

        foreach (
            [
                ['T1', '711', 'RF1'],
                ['T1', '712', 'RF2'],
                ['T2', '81', 'RF5'],
                ['T3', '76', 'RF76'],
                ['T4', '80', 'RF80'],
                ['T4', '99', 'RF137'],
            ] as [$table, $nature, $rf]
        ) {
            $this->addSql(
                'INSERT INTO sof_table_fiscale_ligne (table_code, nature, code_rf) VALUES (?, ?, ?)',
                [$table, $nature, $rf],
            );
        }

        foreach (
            [
                ['MDR', '710', 'Compensation'],
                ['MDR', '730', 'Titres'],
                ['MDR', '750', 'Virement interne'],
                ['MDR', '780', 'Régularisation'],
                ['MDR', '800', 'Annulation'],
                ['MDR', '850', 'Reprise'],
                ['MDR', '900', 'Divers'],
                ['NATURE', '6571', 'Cotisations internationales'],
                ['NATURE', '6572', 'Contributions aux organisations régionales'],
            ] as [$type, $code, $lib]
        ) {
            $this->addSql(
                'INSERT INTO sof_exclusion_rap (type, code, libelle) VALUES (?, ?, ?)',
                [$type, $code, $lib],
            );
        }
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP TABLE sof_grille_valeur');
        $this->addSql('DROP TABLE sof_grille_ligne');
        $this->addSql('DROP TABLE sof_grille');
        $this->addSql('DROP TABLE sof_exclusion_rap');
        $this->addSql('DROP TABLE sof_table_fiscale_ligne');
        $this->addSql('DROP TABLE sof_table_fiscale_compte');
    }
}
