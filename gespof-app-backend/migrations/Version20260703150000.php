<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260703150000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Ajoute les colonnes chemin_fichier et hash_fichier sur fiche_depenses';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE fiche_depenses ADD chemin_fichier VARCHAR(500) DEFAULT NULL');
        $this->addSql('ALTER TABLE fiche_depenses ADD hash_fichier VARCHAR(255) DEFAULT NULL');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE fiche_depenses DROP chemin_fichier');
        $this->addSql('ALTER TABLE fiche_depenses DROP hash_fichier');
    }
}
