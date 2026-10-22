<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Lie une fiche de dépôt SR à la Fiche Bleue reçue du Service Prévision.
 */
final class Version20260826143000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'fiche_depenses : rattachement optionnel à la fiche bleue reçue du SP.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE fiche_depenses ADD fiche_bleue_id INT DEFAULT NULL');
        $this->addSql('ALTER TABLE fiche_depenses ADD CONSTRAINT FK_FICHE_DEPENSES_FICHE_BLEUE
            FOREIGN KEY (fiche_bleue_id) REFERENCES fiche_bleue (id) ON DELETE SET NULL NOT DEFERRABLE INITIALLY IMMEDIATE');
        $this->addSql('CREATE INDEX IDX_FICHE_DEPENSES_FICHE_BLEUE ON fiche_depenses (fiche_bleue_id)');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE fiche_depenses DROP CONSTRAINT FK_FICHE_DEPENSES_FICHE_BLEUE');
        $this->addSql('DROP INDEX IDX_FICHE_DEPENSES_FICHE_BLEUE');
        $this->addSql('ALTER TABLE fiche_depenses DROP fiche_bleue_id');
    }
}
