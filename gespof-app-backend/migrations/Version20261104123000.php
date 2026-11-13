<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/** SOF : élargir balance_initiale (soldes Trésor en FCFA). */
final class Version20261104123000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'SOF : sof_exercice.balance_initiale NUMERIC(20,2).';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE sof_exercice ALTER COLUMN balance_initiale TYPE NUMERIC(20, 2)');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE sof_exercice ALTER COLUMN balance_initiale TYPE NUMERIC(15, 2)');
    }
}
