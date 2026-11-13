<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Points d'attention de l'annexe SROT (page Accueil — Période en cours).
 */
final class Version20261105190000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'SOF : sof_point_attention (checklist annexe SROT)';
    }

    public function up(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
            CREATE TABLE sof_point_attention (
                id SERIAL NOT NULL,
                periode_id INT NOT NULL,
                code VARCHAR(32) NOT NULL,
                coche BOOLEAN NOT NULL DEFAULT FALSE,
                coche_le TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL,
                PRIMARY KEY (id),
                CONSTRAINT uniq_sof_point_attention_periode_code UNIQUE (periode_id, code),
                CONSTRAINT fk_sof_point_attention_periode FOREIGN KEY (periode_id)
                    REFERENCES sof_periode (id) ON DELETE CASCADE
            )
        SQL);
        $this->addSql('CREATE INDEX idx_sof_point_attention_periode ON sof_point_attention (periode_id)');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP TABLE sof_point_attention');
    }
}
