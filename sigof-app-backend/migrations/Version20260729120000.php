<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260729120000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return "Ajoute mouvement_systac.montant_groupe (agrégation par désignation, déjà calculée par "
            . "FicheDepensesService mais jusqu'ici jetée) et rétro-remplit les fiches déjà générées "
            . "à partir de la somme de leurs ligne_systac.montant_groupe.";
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE mouvement_systac ADD montant_groupe DOUBLE PRECISION DEFAULT NULL');
        $this->addSql(<<<'SQL'
            UPDATE mouvement_systac ms
            SET montant_groupe = COALESCE(
                (SELECT SUM(ls.montant_groupe) FROM ligne_systac ls WHERE ls.mouvement_systac_id = ms.id),
                0
            )
            SQL);
        $this->addSql('ALTER TABLE mouvement_systac ALTER COLUMN montant_groupe SET NOT NULL');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE mouvement_systac DROP montant_groupe');
    }
}
