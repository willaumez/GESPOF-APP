<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * SOF Lot 1 : portee exclusions RAP + NATURE, code_synthese, categories_observees.
 */
final class Version20261113140000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'SOF Lot 1 : sof_exclusion_rap.portee + NATURE, rename code_exclusion→code_synthese, postes.categories_observees';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE sof_exclusion_rap ADD portee VARCHAR(32) DEFAULT NULL');
        $this->addSql("UPDATE sof_exclusion_rap SET portee = 'RAP_MODE_BOP' WHERE type = 'MDR' AND portee IS NULL");
        $this->addSql("UPDATE sof_exclusion_rap SET portee = 'TOUTES' WHERE type = 'ORDONNANCE' AND portee IS NULL");

        $this->addSql(<<<'SQL'
            INSERT INTO sof_exclusion_rap (type, code, libelle, motif, date_exclusion, auteur, portee)
            SELECT 'NATURE', 'COTISATIONS INTERNATIONALES',
                   'Cotisations internationales',
                   'Methods.donnees_rap — RAP avant BOP uniquement',
                   CURRENT_DATE, 'SYSTEME', 'RAP_AVANT_BOP'
            WHERE NOT EXISTS (
                SELECT 1 FROM sof_exclusion_rap
                WHERE type = 'NATURE' AND code = 'COTISATIONS INTERNATIONALES'
            )
        SQL);

        $this->addSql('ALTER TABLE sof_rubrique_depense RENAME COLUMN code_exclusion TO code_synthese');

        $this->addSql('ALTER TABLE sof_poste_comptable ADD categories_observees VARCHAR(255) DEFAULT NULL');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE sof_poste_comptable DROP COLUMN categories_observees');
        $this->addSql('ALTER TABLE sof_rubrique_depense RENAME COLUMN code_synthese TO code_exclusion');
        $this->addSql("DELETE FROM sof_exclusion_rap WHERE type = 'NATURE' AND code = 'COTISATIONS INTERNATIONALES'");
        $this->addSql('ALTER TABLE sof_exclusion_rap DROP COLUMN portee');
    }
}
