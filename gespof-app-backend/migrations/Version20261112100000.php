<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261112100000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Utilisateur : genre + photo de profil (chemin / empreinte)';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE utilisateur ADD genre VARCHAR(10) DEFAULT NULL');
        $this->addSql('ALTER TABLE utilisateur ADD photo_chemin VARCHAR(255) DEFAULT NULL');
        $this->addSql('ALTER TABLE utilisateur ADD photo_empreinte VARCHAR(64) DEFAULT NULL');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE utilisateur DROP genre');
        $this->addSql('ALTER TABLE utilisateur DROP photo_chemin');
        $this->addSql('ALTER TABLE utilisateur DROP photo_empreinte');
    }
}
