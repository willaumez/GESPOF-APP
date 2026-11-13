<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * SOF Lot 5 : operation_ajustement (SPEC §7).
 */
final class Version20261113150000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'SOF Lot 5 : sof_operation_ajustement';
    }

    public function up(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
            CREATE TABLE sof_operation_ajustement (
                id SERIAL NOT NULL,
                periode_id INT NOT NULL,
                date_operation DATE NOT NULL,
                nature VARCHAR(16) NOT NULL,
                code_ajustement VARCHAR(32) NOT NULL,
                code_srot VARCHAR(16) DEFAULT NULL,
                libelle VARCHAR(255) DEFAULT NULL,
                montant NUMERIC(20, 2) NOT NULL,
                motif VARCHAR(500) NOT NULL,
                contre_passation_de_id INT DEFAULT NULL,
                cree_par_id INT DEFAULT NULL,
                cree_le TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                PRIMARY KEY(id)
            )
        SQL);
        $this->addSql('CREATE INDEX idx_sof_op_ajust_periode ON sof_operation_ajustement (periode_id)');
        $this->addSql('CREATE INDEX idx_sof_op_ajust_code_srot ON sof_operation_ajustement (code_srot, periode_id)');
        $this->addSql('ALTER TABLE sof_operation_ajustement ADD CONSTRAINT fk_sof_op_ajust_periode FOREIGN KEY (periode_id) REFERENCES sof_periode (id) ON DELETE RESTRICT NOT DEFERRABLE INITIALLY IMMEDIATE');
        $this->addSql('ALTER TABLE sof_operation_ajustement ADD CONSTRAINT fk_sof_op_ajust_cp FOREIGN KEY (contre_passation_de_id) REFERENCES sof_operation_ajustement (id) ON DELETE RESTRICT NOT DEFERRABLE INITIALLY IMMEDIATE');
        $this->addSql('ALTER TABLE sof_operation_ajustement ADD CONSTRAINT fk_sof_op_ajust_user FOREIGN KEY (cree_par_id) REFERENCES utilisateur (id) ON DELETE SET NULL NOT DEFERRABLE INITIALLY IMMEDIATE');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE sof_operation_ajustement DROP CONSTRAINT fk_sof_op_ajust_periode');
        $this->addSql('ALTER TABLE sof_operation_ajustement DROP CONSTRAINT fk_sof_op_ajust_cp');
        $this->addSql('ALTER TABLE sof_operation_ajustement DROP CONSTRAINT fk_sof_op_ajust_user');
        $this->addSql('DROP TABLE sof_operation_ajustement');
    }
}
