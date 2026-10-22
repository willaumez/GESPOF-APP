<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Snapshot date d'ouverture + recettes/dépenses Oracle liées à la journée.
 */
final class Version20260825130000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'journee_tresorerie : snapshot operations_jour (date d\'ouverture, recettes, dépenses).';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE journee_tresorerie ADD operations_jour JSON DEFAULT NULL');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE journee_tresorerie DROP COLUMN operations_jour');
    }
}
