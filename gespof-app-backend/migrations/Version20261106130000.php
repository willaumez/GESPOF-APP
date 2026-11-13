<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261106130000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'SOF : surcharges (date_debut/date_fin par preset) sur extraction_lancement';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE sof_extraction_lancement ADD surcharges JSON DEFAULT NULL');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE sof_extraction_lancement DROP surcharges');
    }
}
