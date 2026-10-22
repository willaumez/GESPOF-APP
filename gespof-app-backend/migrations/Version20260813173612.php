<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260813173612 extends AbstractMigration
{
    public function getDescription(): string
    {
        return "Ajoute utilisateur.acces_retires (liste JSON d'App\Shared\Enum\Acces) : permet a un "
            . "administrateur de retirer individuellement, pour un utilisateur precis, un acces normalement "
            . "accorde par son metier — sans affecter les autres utilisateurs du meme metier.";
    }

    public function up(Schema $schema): void
    {
        $this->addSql("ALTER TABLE utilisateur ADD acces_retires JSON DEFAULT '[]' NOT NULL");
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE utilisateur DROP acces_retires');
    }
}
