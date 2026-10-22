<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Ajoute le type métier (solde / recette / depense) aux sections de la
 * bibliothèque Fiche Bleue. Les sections existantes sont classées en
 * « recette » par défaut ; le type SOLDE permet notamment « SOLDE BANCAIRE
 * D'ENTREE », section d'en-tête unique d'une Fiche Bleue (contrainte fiche
 * à venir).
 */
final class Version20260820110000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Ajoute bibliotheque_section.type (solde|recette|depense).';
    }

    public function up(Schema $schema): void
    {
        $this->addSql(
            "ALTER TABLE bibliotheque_section "
            . "ADD type VARCHAR(20) DEFAULT 'recette' NOT NULL"
        );
        $this->addSql('CREATE INDEX IDX_BB5DEEDC8CDE5729 ON bibliotheque_section (type)');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP INDEX IDX_BB5DEEDC8CDE5729');
        $this->addSql('ALTER TABLE bibliotheque_section DROP type');
    }
}
