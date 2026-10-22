<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Liste des dépenses validée pour la journée : union dédoublonnée des
 * fiches de dépôt reçues (base du rapprochement des dépenses).
 */
final class Version20261006090000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'journee_tresorerie : liste des dépenses du jour validée (depenses_jour).';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE journee_tresorerie ADD depenses_jour JSON DEFAULT NULL');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE journee_tresorerie DROP COLUMN depenses_jour');
    }
}
