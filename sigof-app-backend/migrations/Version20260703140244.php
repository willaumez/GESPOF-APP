<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260703140244 extends AbstractMigration
{
    public function getDescription(): string
    {
        return '';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE fiche_depenses DROP CONSTRAINT fk_882b345a2fa9c009');
        $this->addSql('ALTER TABLE fiche_depenses DROP CONSTRAINT fk_882b345ac8e00bfa');
        $this->addSql('DROP INDEX idx_882b345ac8e00bfa');
        $this->addSql('DROP INDEX idx_882b345a2fa9c009');
        $this->addSql('ALTER TABLE fiche_depenses ADD total_montant_systac DOUBLE PRECISION NOT NULL');
        $this->addSql('ALTER TABLE fiche_depenses ADD total_montant_groupe DOUBLE PRECISION NOT NULL');
        $this->addSql('ALTER TABLE fiche_depenses DROP date_debut');
        $this->addSql('ALTER TABLE fiche_depenses DROP date_fin');
        $this->addSql('ALTER TABLE fiche_depenses DROP montant_total');
        $this->addSql('ALTER TABLE fiche_depenses DROP date_envoi');
        $this->addSql('ALTER TABLE fiche_depenses DROP date_reception');
        $this->addSql('ALTER TABLE fiche_depenses DROP chemin_fichier');
        $this->addSql('ALTER TABLE fiche_depenses DROP hash_fichier');
        $this->addSql('ALTER TABLE fiche_depenses DROP systemes');
        $this->addSql('ALTER TABLE fiche_depenses DROP envoye_par');
        $this->addSql('ALTER TABLE fiche_depenses ALTER statut TYPE VARCHAR(30)');
        $this->addSql('ALTER TABLE fiche_depenses ALTER statut DROP NOT NULL');
        $this->addSql('ALTER TABLE fiche_depenses ALTER date_creation TYPE TIMESTAMP(0) WITHOUT TIME ZONE');
        $this->addSql('ALTER TABLE fiche_depenses RENAME COLUMN genere_par TO utilisateur_id');
        $this->addSql('ALTER TABLE fiche_depenses ADD CONSTRAINT FK_882B345AFB88E14F FOREIGN KEY (utilisateur_id) REFERENCES utilisateur (id) NOT DEFERRABLE');
        $this->addSql('CREATE INDEX IDX_882B345AFB88E14F ON fiche_depenses (utilisateur_id)');
        $this->addSql('ALTER TABLE historique_fiche ADD commentaire TEXT DEFAULT NULL');
        $this->addSql('ALTER TABLE historique_fiche ADD ancien_statut VARCHAR(30) DEFAULT NULL');
        $this->addSql('ALTER TABLE historique_fiche ADD nouveau_statut VARCHAR(30) DEFAULT NULL');
        $this->addSql('ALTER TABLE historique_fiche ALTER action TYPE VARCHAR(50)');
        $this->addSql('ALTER TABLE historique_fiche RENAME COLUMN horodatage TO date_action');
        $this->addSql('ALTER TABLE ligne_fiche_depenses ADD c_orig VARCHAR(10) DEFAULT NULL');
        $this->addSql('ALTER TABLE ligne_fiche_depenses ADD d_presentation TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL');
        $this->addSql('ALTER TABLE ligne_fiche_depenses ADD n_bv VARCHAR(20) NOT NULL');
        $this->addSql('ALTER TABLE ligne_fiche_depenses ADD montant_groupe DOUBLE PRECISION NOT NULL');
        $this->addSql('ALTER TABLE ligne_fiche_depenses ADD designation VARCHAR(255) NOT NULL');
        $this->addSql('ALTER TABLE ligne_fiche_depenses ADD d_creation_ip TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL');
        $this->addSql('ALTER TABLE ligne_fiche_depenses ADD d_generation TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL');
        $this->addSql('ALTER TABLE ligne_fiche_depenses DROP pc');
        $this->addSql('ALTER TABLE ligne_fiche_depenses DROP numero');
        $this->addSql('ALTER TABLE ligne_fiche_depenses DROP libelle_origine');
        $this->addSql('ALTER TABLE ligne_fiche_depenses DROP d_valeur');
        $this->addSql('ALTER TABLE ligne_fiche_depenses DROP d_pres');
        $this->addSql('ALTER TABLE ligne_fiche_depenses DROP nb_bv');
        $this->addSql('ALTER TABLE ligne_fiche_depenses DROP nb_regl_sygma');
        $this->addSql('ALTER TABLE ligne_fiche_depenses DROP montant_sygma');
        $this->addSql('ALTER TABLE ligne_fiche_depenses DROP statut');
        $this->addSql('ALTER TABLE ligne_fiche_depenses DROP validation_tc');
        $this->addSql('ALTER TABLE ligne_fiche_depenses DROP systeme');
        $this->addSql('ALTER TABLE ligne_fiche_depenses DROP montant');
        $this->addSql('ALTER TABLE ligne_fiche_depenses DROP nb_regl_systac');
        $this->addSql('ALTER TABLE ligne_fiche_depenses DROP reception');
        $this->addSql('ALTER TABLE ligne_fiche_depenses DROP generation');
        $this->addSql('ALTER TABLE ligne_fiche_depenses ALTER nb_regl TYPE DOUBLE PRECISION');
        $this->addSql('ALTER TABLE ligne_fiche_depenses ALTER nb_regl SET NOT NULL');
        $this->addSql('ALTER TABLE ligne_fiche_depenses ALTER montant_systac TYPE DOUBLE PRECISION');
        $this->addSql('ALTER TABLE ligne_fiche_depenses ALTER montant_systac SET NOT NULL');
        $this->addSql('ALTER TABLE ligne_fiche_depenses RENAME COLUMN numero_bv TO l_orig');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE fiche_depenses DROP CONSTRAINT FK_882B345AFB88E14F');
        $this->addSql('DROP INDEX IDX_882B345AFB88E14F');
        $this->addSql('ALTER TABLE fiche_depenses ADD date_debut DATE NOT NULL');
        $this->addSql('ALTER TABLE fiche_depenses ADD date_fin DATE NOT NULL');
        $this->addSql('ALTER TABLE fiche_depenses ADD montant_total NUMERIC(15, 2) DEFAULT \'0.00\' NOT NULL');
        $this->addSql('ALTER TABLE fiche_depenses ADD date_envoi DATE DEFAULT NULL');
        $this->addSql('ALTER TABLE fiche_depenses ADD date_reception DATE DEFAULT NULL');
        $this->addSql('ALTER TABLE fiche_depenses ADD chemin_fichier VARCHAR(500) DEFAULT NULL');
        $this->addSql('ALTER TABLE fiche_depenses ADD hash_fichier VARCHAR(255) DEFAULT NULL');
        $this->addSql('ALTER TABLE fiche_depenses ADD systemes JSON NOT NULL');
        $this->addSql('ALTER TABLE fiche_depenses ADD envoye_par INT DEFAULT NULL');
        $this->addSql('ALTER TABLE fiche_depenses DROP total_montant_systac');
        $this->addSql('ALTER TABLE fiche_depenses DROP total_montant_groupe');
        $this->addSql('ALTER TABLE fiche_depenses ALTER date_creation TYPE DATE');
        $this->addSql('ALTER TABLE fiche_depenses ALTER statut TYPE VARCHAR(255)');
        $this->addSql('ALTER TABLE fiche_depenses ALTER statut SET NOT NULL');
        $this->addSql('ALTER TABLE fiche_depenses RENAME COLUMN utilisateur_id TO genere_par');
        $this->addSql('ALTER TABLE fiche_depenses ADD CONSTRAINT fk_882b345a2fa9c009 FOREIGN KEY (envoye_par) REFERENCES utilisateur (id) NOT DEFERRABLE INITIALLY IMMEDIATE');
        $this->addSql('ALTER TABLE fiche_depenses ADD CONSTRAINT fk_882b345ac8e00bfa FOREIGN KEY (genere_par) REFERENCES utilisateur (id) NOT DEFERRABLE INITIALLY IMMEDIATE');
        $this->addSql('CREATE INDEX idx_882b345ac8e00bfa ON fiche_depenses (genere_par)');
        $this->addSql('CREATE INDEX idx_882b345a2fa9c009 ON fiche_depenses (envoye_par)');
        $this->addSql('ALTER TABLE historique_fiche DROP commentaire');
        $this->addSql('ALTER TABLE historique_fiche DROP ancien_statut');
        $this->addSql('ALTER TABLE historique_fiche DROP nouveau_statut');
        $this->addSql('ALTER TABLE historique_fiche ALTER action TYPE VARCHAR(255)');
        $this->addSql('ALTER TABLE historique_fiche RENAME COLUMN date_action TO horodatage');
        $this->addSql('ALTER TABLE ligne_fiche_depenses ADD pc VARCHAR(50) NOT NULL');
        $this->addSql('ALTER TABLE ligne_fiche_depenses ADD numero VARCHAR(100) NOT NULL');
        $this->addSql('ALTER TABLE ligne_fiche_depenses ADD libelle_origine VARCHAR(500) NOT NULL');
        $this->addSql('ALTER TABLE ligne_fiche_depenses ADD d_valeur NUMERIC(15, 2) DEFAULT NULL');
        $this->addSql('ALTER TABLE ligne_fiche_depenses ADD d_pres NUMERIC(15, 2) DEFAULT NULL');
        $this->addSql('ALTER TABLE ligne_fiche_depenses ADD nb_bv NUMERIC(10, 2) DEFAULT NULL');
        $this->addSql('ALTER TABLE ligne_fiche_depenses ADD nb_regl_sygma NUMERIC(10, 2) DEFAULT NULL');
        $this->addSql('ALTER TABLE ligne_fiche_depenses ADD montant_sygma NUMERIC(15, 2) DEFAULT NULL');
        $this->addSql('ALTER TABLE ligne_fiche_depenses ADD statut VARCHAR(50) DEFAULT NULL');
        $this->addSql('ALTER TABLE ligne_fiche_depenses ADD validation_tc VARCHAR(50) DEFAULT NULL');
        $this->addSql('ALTER TABLE ligne_fiche_depenses ADD systeme VARCHAR(10) NOT NULL');
        $this->addSql('ALTER TABLE ligne_fiche_depenses ADD montant NUMERIC(15, 2) DEFAULT NULL');
        $this->addSql('ALTER TABLE ligne_fiche_depenses ADD nb_regl_systac NUMERIC(10, 2) DEFAULT NULL');
        $this->addSql('ALTER TABLE ligne_fiche_depenses ADD reception DATE DEFAULT NULL');
        $this->addSql('ALTER TABLE ligne_fiche_depenses ADD generation DATE DEFAULT NULL');
        $this->addSql('ALTER TABLE ligne_fiche_depenses DROP c_orig');
        $this->addSql('ALTER TABLE ligne_fiche_depenses DROP d_presentation');
        $this->addSql('ALTER TABLE ligne_fiche_depenses DROP n_bv');
        $this->addSql('ALTER TABLE ligne_fiche_depenses DROP montant_groupe');
        $this->addSql('ALTER TABLE ligne_fiche_depenses DROP designation');
        $this->addSql('ALTER TABLE ligne_fiche_depenses DROP d_creation_ip');
        $this->addSql('ALTER TABLE ligne_fiche_depenses DROP d_generation');
        $this->addSql('ALTER TABLE ligne_fiche_depenses ALTER nb_regl TYPE NUMERIC(10, 2)');
        $this->addSql('ALTER TABLE ligne_fiche_depenses ALTER nb_regl DROP NOT NULL');
        $this->addSql('ALTER TABLE ligne_fiche_depenses ALTER montant_systac TYPE NUMERIC(15, 2)');
        $this->addSql('ALTER TABLE ligne_fiche_depenses ALTER montant_systac DROP NOT NULL');
        $this->addSql('ALTER TABLE ligne_fiche_depenses RENAME COLUMN l_orig TO numero_bv');
    }
}
