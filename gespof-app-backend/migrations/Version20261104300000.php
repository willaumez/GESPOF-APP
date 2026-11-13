<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261104300000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'SOF : index c_ref1 sur sof_ig_operation pour les imports IG VIDR.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('CREATE INDEX idx_sof_ig_operation_c_ref1 ON sof_ig_operation (c_ref1)');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP INDEX idx_sof_ig_operation_c_ref1');
    }
}
