<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Journée de trésorerie : fiches Bleue / exécution optionnelles à la création
 * (état BROUILLON sans fiches liées).
 */
final class Version20260820140000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Rend fiche_bleue_id et fiche_execution_id nullable sur journee_tresorerie.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE journee_tresorerie ALTER fiche_bleue_id DROP NOT NULL');
        $this->addSql('ALTER TABLE journee_tresorerie ALTER fiche_execution_id DROP NOT NULL');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE journee_tresorerie ALTER fiche_bleue_id SET NOT NULL');
        $this->addSql('ALTER TABLE journee_tresorerie ALTER fiche_execution_id SET NOT NULL');
    }
}
