<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260717150000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return "Remplace utilisateur.role (RoleAcces unique) par utilisateur.roles (liste JSON de RoleAcces).";
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE utilisateur ADD roles JSON DEFAULT NULL');
        $this->addSql("UPDATE utilisateur SET roles = ('[\"' || role || '\"]')::json");
        $this->addSql('ALTER TABLE utilisateur ALTER COLUMN roles SET NOT NULL');
        $this->addSql('ALTER TABLE utilisateur DROP role');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE utilisateur ADD role VARCHAR(255) DEFAULT NULL');
        $this->addSql('UPDATE utilisateur SET role = roles->>0');
        $this->addSql('ALTER TABLE utilisateur ALTER COLUMN role SET NOT NULL');
        $this->addSql('ALTER TABLE utilisateur DROP roles');
    }
}
