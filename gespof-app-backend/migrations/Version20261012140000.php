<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261012140000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'SOF : colonne actif sur sof_compte_douane (alignement entité CompteDouane).';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE sof_compte_douane ADD actif BOOLEAN DEFAULT true NOT NULL');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE sof_compte_douane DROP COLUMN actif');
    }
}
