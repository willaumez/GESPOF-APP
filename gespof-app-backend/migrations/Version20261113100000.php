<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * SOF 0.9 — retire les exclusions RAP de type NATURE (sans source manuel/code).
 */
final class Version20261113100000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'SOF : purge sof_exclusion_rap type NATURE (6571, 6572…)';
    }

    public function up(Schema $schema): void
    {
        $this->addSql("DELETE FROM sof_exclusion_rap WHERE type = 'NATURE'");
    }

    public function down(Schema $schema): void
    {
        // Irréversible volontairement : natures hors modèle.
    }
}
