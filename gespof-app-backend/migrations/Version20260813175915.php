<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260813175915 extends AbstractMigration
{
    public function getDescription(): string
    {
        return "Retire le DEFAULT '[]' d'utilisateur.acces_retires (n'etait utile qu'a la migration "
            . "precedente pour retro-remplir la colonne) : le mapping Doctrine ne le declare pas et "
            . "l'entite/l'application definissent toujours explicitement la valeur, comme pour "
            . "utilisateur.roles.";
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE utilisateur ALTER acces_retires DROP DEFAULT');
    }

    public function down(Schema $schema): void
    {
        $this->addSql("ALTER TABLE utilisateur ALTER acces_retires SET DEFAULT '[]'");
    }
}
