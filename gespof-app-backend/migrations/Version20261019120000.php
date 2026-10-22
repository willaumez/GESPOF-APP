<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261019120000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'SR : flag modifie_manuellement sur lignes/mouvements fiche dépôt.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE ligne_systac ADD modifie_manuellement BOOLEAN DEFAULT false NOT NULL');
        $this->addSql('ALTER TABLE mouvement_sygma ADD modifie_manuellement BOOLEAN DEFAULT false NOT NULL');
        $this->addSql('ALTER TABLE mouvement_numeraire ADD modifie_manuellement BOOLEAN DEFAULT false NOT NULL');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE ligne_systac DROP COLUMN modifie_manuellement');
        $this->addSql('ALTER TABLE mouvement_sygma DROP COLUMN modifie_manuellement');
        $this->addSql('ALTER TABLE mouvement_numeraire DROP COLUMN modifie_manuellement');
    }
}
