<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * SOF Configuration : alignement schéma (préfixe AD, postes, sociétés, comptes, dépenses).
 */
final class Version20261112140000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'SOF config : prefixe_ad SMALLINT, poste.categorie_defaut, redevance nullable, fichier compte, code_exclusion.';
    }

    public function up(Schema $schema): void
    {
        // A1 — préfixe AD : conserver les chiffres (« AD26 » → 26)
        $this->addSql('ALTER TABLE sof_exercice ADD prefixe_ad_tmp SMALLINT DEFAULT NULL');
        $this->addSql(<<<'SQL'
            UPDATE sof_exercice
            SET prefixe_ad_tmp = CASE
                WHEN regexp_replace(prefixe_ad, '[^0-9]', '', 'g') = '' THEN (annee % 100)
                ELSE LEAST(99, GREATEST(0, CAST(regexp_replace(prefixe_ad, '[^0-9]', '', 'g') AS INTEGER) % 100))
            END
        SQL);
        $this->addSql('ALTER TABLE sof_exercice DROP COLUMN prefixe_ad');
        $this->addSql('ALTER TABLE sof_exercice RENAME COLUMN prefixe_ad_tmp TO prefixe_ad');
        $this->addSql('ALTER TABLE sof_exercice ALTER COLUMN prefixe_ad SET NOT NULL');
        $this->addSql('ALTER TABLE sof_exercice ADD CONSTRAINT chk_sof_exercice_prefixe_ad CHECK (prefixe_ad >= 0 AND prefixe_ad <= 99)');

        // A3 — exclusions nomenclature dépenses
        $this->addSql('ALTER TABLE sof_rubrique_depense ADD code_exclusion VARCHAR(10) DEFAULT NULL');

        // A5 — nom de feuille source
        $this->addSql('ALTER TABLE sof_compte_suivi ADD fichier VARCHAR(64) DEFAULT NULL');

        // A6 — redevance superficiaire minimale optionnelle
        $this->addSql('ALTER TABLE sof_societe_petroliere ALTER COLUMN redevance_sup_min DROP NOT NULL');
        $this->addSql('ALTER TABLE sof_societe_petroliere ALTER COLUMN redevance_sup_min DROP DEFAULT');

        // A7 — catégorie du poste = défaut (la ligne porte C_CATEG)
        $this->addSql('ALTER TABLE sof_poste_comptable RENAME COLUMN categorie TO categorie_defaut');
        $this->addSql('ALTER INDEX idx_sof_poste_comptable_categorie RENAME TO idx_sof_poste_comptable_categorie_defaut');

        // A2 — remplacer codes TOFE démo par codes réels (1–99)
        $this->addSql('DELETE FROM sof_code_tofe');
        foreach (
            [
                ['4', 'IS'],
                ['7', 'dont TVA brute'],
                ['9', 'Autres Taxes sur les Biens et Services'],
                ['10', 'Douanes'],
                ['11', 'Impôt sur les Sociétés'],
                ['12', 'Impôt sur les personnes physiques'],
                ['13', 'Autres Recettes Fiscales'],
                ['16', 'RMP'],
                ['17', 'Autres'],
                ['19', 'Hors pétrolières'],
                ['20', 'Recettes comptes de correspondants'],
            ] as [$code, $libelle]
        ) {
            $this->addSql(
                'INSERT INTO sof_code_tofe (code, libelle) VALUES (?, ?)',
                [$code, $libelle],
            );
        }

        // A8 — vider tables fiscales de démonstration
        $this->addSql('DELETE FROM sof_table_fiscale_ligne');
        $this->addSql('DELETE FROM sof_table_fiscale_compte');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER INDEX idx_sof_poste_comptable_categorie_defaut RENAME TO idx_sof_poste_comptable_categorie');
        $this->addSql('ALTER TABLE sof_poste_comptable RENAME COLUMN categorie_defaut TO categorie');

        $this->addSql('ALTER TABLE sof_societe_petroliere ALTER COLUMN redevance_sup_min SET DEFAULT 0');
        $this->addSql("UPDATE sof_societe_petroliere SET redevance_sup_min = 0 WHERE redevance_sup_min IS NULL");
        $this->addSql('ALTER TABLE sof_societe_petroliere ALTER COLUMN redevance_sup_min SET NOT NULL');

        $this->addSql('ALTER TABLE sof_compte_suivi DROP COLUMN fichier');
        $this->addSql('ALTER TABLE sof_rubrique_depense DROP COLUMN code_exclusion');

        $this->addSql('ALTER TABLE sof_exercice DROP CONSTRAINT chk_sof_exercice_prefixe_ad');
        $this->addSql('ALTER TABLE sof_exercice ADD prefixe_ad_txt VARCHAR(16) DEFAULT NULL');
        $this->addSql("UPDATE sof_exercice SET prefixe_ad_txt = 'AD' || LPAD(prefixe_ad::text, 2, '0')");
        $this->addSql('ALTER TABLE sof_exercice DROP COLUMN prefixe_ad');
        $this->addSql('ALTER TABLE sof_exercice RENAME COLUMN prefixe_ad_txt TO prefixe_ad');
        $this->addSql('ALTER TABLE sof_exercice ALTER COLUMN prefixe_ad SET NOT NULL');

        $this->addSql('DELETE FROM sof_code_tofe');
        foreach (
            [
                ['1.1.1', 'Recettes pétrolières'],
                ['1.1.2', 'Recettes fiscales'],
                ['1.1.3', 'Recettes non fiscales'],
                ['1.1.4', 'Recettes affectées'],
                ['2.1', 'Dépenses des exercices antérieurs'],
                ['2.2', "Dépenses de l'exercice"],
                ['3.2', 'Emprunts'],
                ['3.3', 'Recettes non budgétaires'],
            ] as [$code, $libelle]
        ) {
            $this->addSql(
                'INSERT INTO sof_code_tofe (code, libelle) VALUES (?, ?)',
                [$code, $libelle],
            );
        }
    }
}
