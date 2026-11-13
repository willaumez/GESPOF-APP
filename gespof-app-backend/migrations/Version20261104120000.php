<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * SOF exercice : champs plan (balance_initiale, loi_en_vigueur, prefixe_ad,
 * delai_arriere_jours, statut, dates).
 */
final class Version20261104120000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'SOF : enrichir sof_exercice (paramétrage Chef SOF).';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE sof_exercice RENAME COLUMN solde_ouverture TO balance_initiale');
        $this->addSql('ALTER TABLE sof_exercice RENAME COLUMN loi_finances_en_vigueur TO loi_en_vigueur_tmp');

        // Normaliser avant de réduire la taille (ex. « LFR 2026 » → LFR).
        $this->addSql(<<<'SQL'
            UPDATE sof_exercice
            SET loi_en_vigueur_tmp = CASE
                WHEN loi_en_vigueur_tmp ILIKE 'LFR%' THEN 'LFR'
                WHEN loi_en_vigueur_tmp ILIKE 'LFI%' THEN 'LFI'
                WHEN loi_en_vigueur_tmp IS NULL OR loi_en_vigueur_tmp = '' THEN 'LFI'
                ELSE 'LFI'
            END
        SQL);

        $this->addSql('ALTER TABLE sof_exercice ADD loi_en_vigueur VARCHAR(8) DEFAULT NULL');
        $this->addSql('UPDATE sof_exercice SET loi_en_vigueur = loi_en_vigueur_tmp');
        $this->addSql('ALTER TABLE sof_exercice DROP COLUMN loi_en_vigueur_tmp');

        $this->addSql('ALTER TABLE sof_exercice ADD prefixe_ad VARCHAR(16) DEFAULT \'AD00\' NOT NULL');
        $this->addSql('ALTER TABLE sof_exercice ADD delai_arriere_jours INT DEFAULT 90 NOT NULL');
        $this->addSql('ALTER TABLE sof_exercice ADD statut VARCHAR(16) DEFAULT \'ouvert\' NOT NULL');
        $this->addSql('ALTER TABLE sof_exercice ADD date_ouverture DATE DEFAULT NULL');
        $this->addSql('ALTER TABLE sof_exercice ADD date_cloture DATE DEFAULT NULL');

        $this->addSql(<<<'SQL'
            UPDATE sof_exercice
            SET prefixe_ad = 'AD' || RIGHT('0' || (annee % 100)::text, 2),
                date_ouverture = MAKE_DATE(annee, 1, 2)
        SQL);

        $this->addSql('ALTER TABLE sof_exercice ALTER COLUMN prefixe_ad DROP DEFAULT');
        $this->addSql('ALTER TABLE sof_exercice ALTER COLUMN delai_arriere_jours DROP DEFAULT');
        $this->addSql('ALTER TABLE sof_exercice ALTER COLUMN statut DROP DEFAULT');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE sof_exercice DROP COLUMN date_cloture');
        $this->addSql('ALTER TABLE sof_exercice DROP COLUMN date_ouverture');
        $this->addSql('ALTER TABLE sof_exercice DROP COLUMN statut');
        $this->addSql('ALTER TABLE sof_exercice DROP COLUMN delai_arriere_jours');
        $this->addSql('ALTER TABLE sof_exercice DROP COLUMN prefixe_ad');

        $this->addSql('ALTER TABLE sof_exercice ADD loi_finances_en_vigueur VARCHAR(255) DEFAULT NULL');
        $this->addSql(<<<'SQL'
            UPDATE sof_exercice
            SET loi_finances_en_vigueur = CASE
                WHEN loi_en_vigueur = 'LFR' THEN 'LFR ' || annee::text
                WHEN loi_en_vigueur = 'LFI' THEN 'LFI ' || annee::text
                ELSE loi_en_vigueur
            END
        SQL);
        $this->addSql('ALTER TABLE sof_exercice DROP COLUMN loi_en_vigueur');
        $this->addSql('ALTER TABLE sof_exercice RENAME COLUMN balance_initiale TO solde_ouverture');
    }
}
