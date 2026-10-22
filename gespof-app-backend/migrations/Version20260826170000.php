<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Distingue les sections / sous-sections ajoutées hors programmation
 * (Fiche d'exécution) des rubriques prévues en Fiche Bleue.
 */
final class Version20260826170000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'section : flag non_programme (ajout hors Fiche Bleue).';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE section ADD non_programme BOOLEAN DEFAULT false NOT NULL');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE section DROP non_programme');
    }
}
