<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Liste des recettes Oracle validée pour la journée (base du rapprochement).
 */
final class Version20261005120000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'journee_tresorerie : liste des recettes du jour validée (recettes_jour).';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE journee_tresorerie ADD recettes_jour JSON DEFAULT NULL');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE journee_tresorerie DROP COLUMN recettes_jour');
    }
}
