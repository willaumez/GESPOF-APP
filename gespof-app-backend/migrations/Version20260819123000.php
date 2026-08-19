<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260819123000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Ajoute fiche_bleue_modele.mis_a_jour_le : date de creation de la maquette, '
            . 'mise a jour a chaque modification. Les maquettes existantes sont datees de now().';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE fiche_bleue_modele ADD mis_a_jour_le TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT now() NOT NULL');
        $this->addSql('ALTER TABLE fiche_bleue_modele ALTER mis_a_jour_le DROP DEFAULT');
        $this->addSql("COMMENT ON COLUMN fiche_bleue_modele.mis_a_jour_le IS '(DC2Type:datetime_immutable)'");
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE fiche_bleue_modele DROP mis_a_jour_le');
    }
}
