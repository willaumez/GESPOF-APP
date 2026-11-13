<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * SOF 0.10–0.15 : Loi de finances, grilles (enrichissement), RAP antérieurs.
 */
final class Version20261113120000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'SOF : sof_loi_finances (+ lf_*), enrichissement sof_grille*, sof_rap_anterieur_*';
    }

    public function up(Schema $schema): void
    {
        // --- Grilles : colonnes + contrainte d'unicité ---
        $this->addSql('ALTER TABLE sof_grille_ligne ADD niveau SMALLINT NOT NULL DEFAULT 0');
        $this->addSql('ALTER TABLE sof_grille_ligne ADD calculable BOOLEAN NOT NULL DEFAULT false');
        $this->addSql('CREATE UNIQUE INDEX uniq_sof_grille_exercice_type ON sof_grille (exercice_annee, type)');

        // --- Loi de finances ---
        $this->addSql(<<<'SQL'
            CREATE TABLE sof_loi_finances (
                id SERIAL NOT NULL,
                exercice_annee INT NOT NULL,
                type VARCHAR(8) NOT NULL,
                libelle VARCHAR(64) NOT NULL,
                date_loi DATE DEFAULT NULL,
                PRIMARY KEY (id),
                CONSTRAINT uniq_sof_loi_finances_ex_type UNIQUE (exercice_annee, type),
                CONSTRAINT chk_sof_loi_finances_type CHECK (type IN ('LFI', 'LFR'))
            )
        SQL);

        $this->addSql(<<<'SQL'
            CREATE TABLE sof_lf_recette (
                id SERIAL NOT NULL,
                loi_id INT NOT NULL,
                rubrique_code VARCHAR(16) NOT NULL,
                libelle VARCHAR(255) NOT NULL,
                montant NUMERIC(20, 2) NOT NULL DEFAULT 0,
                PRIMARY KEY (id),
                CONSTRAINT uniq_sof_lf_recette_loi_rubrique UNIQUE (loi_id, rubrique_code),
                CONSTRAINT fk_sof_lf_recette_loi FOREIGN KEY (loi_id)
                    REFERENCES sof_loi_finances (id) ON DELETE CASCADE
            )
        SQL);

        $this->addSql(<<<'SQL'
            CREATE TABLE sof_lf_depense (
                id SERIAL NOT NULL,
                loi_id INT NOT NULL,
                mission VARCHAR(32) DEFAULT NULL,
                l_mis VARCHAR(255) DEFAULT NULL,
                prog VARCHAR(32) DEFAULT NULL,
                titre VARCHAR(16) DEFAULT NULL,
                l_titre VARCHAR(255) DEFAULT NULL,
                bop VARCHAR(32) DEFAULT NULL,
                l_bop VARCHAR(255) DEFAULT NULL,
                l_prog VARCHAR(255) DEFAULT NULL,
                budget VARCHAR(32) DEFAULT NULL,
                nat VARCHAR(32) DEFAULT NULL,
                montant NUMERIC(20, 2) NOT NULL DEFAULT 0,
                PRIMARY KEY (id),
                CONSTRAINT fk_sof_lf_depense_loi FOREIGN KEY (loi_id)
                    REFERENCES sof_loi_finances (id) ON DELETE CASCADE
            )
        SQL);
        $this->addSql('CREATE INDEX idx_sof_lf_depense_loi ON sof_lf_depense (loi_id)');

        $this->addSql(<<<'SQL'
            CREATE TABLE sof_lf_financement (
                id SERIAL NOT NULL,
                loi_id INT NOT NULL,
                code VARCHAR(32) NOT NULL,
                libelle VARCHAR(255) NOT NULL,
                montant NUMERIC(20, 2) NOT NULL DEFAULT 0,
                ordre INT NOT NULL DEFAULT 0,
                PRIMARY KEY (id),
                CONSTRAINT fk_sof_lf_financement_loi FOREIGN KEY (loi_id)
                    REFERENCES sof_loi_finances (id) ON DELETE CASCADE
            )
        SQL);
        $this->addSql('CREATE INDEX idx_sof_lf_financement_loi ON sof_lf_financement (loi_id)');

        $this->addSql(<<<'SQL'
            CREATE TABLE sof_lf_taux_affectation (
                id SERIAL NOT NULL,
                loi_id INT NOT NULL,
                rubrique_code VARCHAR(16) NOT NULL,
                beneficiaire VARCHAR(255) NOT NULL,
                nature VARCHAR(128) NOT NULL,
                taux NUMERIC(10, 6) NOT NULL DEFAULT 0,
                PRIMARY KEY (id),
                CONSTRAINT fk_sof_lf_taux_affectation_loi FOREIGN KEY (loi_id)
                    REFERENCES sof_loi_finances (id) ON DELETE CASCADE
            )
        SQL);
        $this->addSql('CREATE INDEX idx_sof_lf_taux_affectation_loi ON sof_lf_taux_affectation (loi_id)');

        // --- RAP antérieurs ---
        $this->addSql(<<<'SQL'
            CREATE TABLE sof_rap_anterieur_lot (
                id SERIAL NOT NULL,
                exercice_annee INT NOT NULL,
                importe_le TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                nb_lignes INT NOT NULL DEFAULT 0,
                total_brut NUMERIC(20, 2) NOT NULL DEFAULT 0,
                total_rap NUMERIC(20, 2) NOT NULL DEFAULT 0,
                fichier VARCHAR(255) DEFAULT NULL,
                PRIMARY KEY (id)
            )
        SQL);
        $this->addSql('CREATE INDEX idx_sof_rap_anterieur_lot_ex ON sof_rap_anterieur_lot (exercice_annee)');

        $this->addSql(<<<'SQL'
            CREATE TABLE sof_rap_anterieur_ligne (
                id SERIAL NOT NULL,
                lot_id INT NOT NULL,
                statut VARCHAR(16) NOT NULL,
                echeance DATE DEFAULT NULL,
                exercice INT NOT NULL,
                ordonnance VARCHAR(64) NOT NULL,
                n_lig VARCHAR(32) DEFAULT NULL,
                ministere VARCHAR(255) DEFAULT NULL,
                titre VARCHAR(16) DEFAULT NULL,
                nature VARCHAR(32) DEFAULT NULL,
                beneficiaire VARCHAR(255) DEFAULT NULL,
                brut NUMERIC(20, 2) NOT NULL DEFAULT 0,
                rap NUMERIC(20, 2) NOT NULL DEFAULT 0,
                c_categ VARCHAR(16) DEFAULT NULL,
                poste VARCHAR(32) DEFAULT NULL,
                payload JSONB DEFAULT NULL,
                PRIMARY KEY (id),
                CONSTRAINT fk_sof_rap_anterieur_ligne_lot FOREIGN KEY (lot_id)
                    REFERENCES sof_rap_anterieur_lot (id) ON DELETE CASCADE,
                CONSTRAINT chk_sof_rap_anterieur_statut CHECK (statut IN ('ARRIERE', 'INSTANCE'))
            )
        SQL);
        $this->addSql('CREATE INDEX idx_sof_rap_anterieur_ligne_lot ON sof_rap_anterieur_ligne (lot_id)');
        $this->addSql('CREATE INDEX idx_sof_rap_anterieur_ligne_ordo ON sof_rap_anterieur_ligne (ordonnance)');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP TABLE sof_rap_anterieur_ligne');
        $this->addSql('DROP TABLE sof_rap_anterieur_lot');
        $this->addSql('DROP TABLE sof_lf_taux_affectation');
        $this->addSql('DROP TABLE sof_lf_financement');
        $this->addSql('DROP TABLE sof_lf_depense');
        $this->addSql('DROP TABLE sof_lf_recette');
        $this->addSql('DROP TABLE sof_loi_finances');
        $this->addSql('DROP INDEX uniq_sof_grille_exercice_type');
        $this->addSql('ALTER TABLE sof_grille_ligne DROP COLUMN calculable');
        $this->addSql('ALTER TABLE sof_grille_ligne DROP COLUMN niveau');
    }
}
