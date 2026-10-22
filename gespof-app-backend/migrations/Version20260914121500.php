<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260914121500 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'SOF : table sof_compte_douane (référentiel des comptes douaniers).';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('CREATE TABLE sof_compte_douane (
            compte VARCHAR(20) NOT NULL,
            type VARCHAR(40) NOT NULL,
            libelle_compte VARCHAR(255) NOT NULL,
            PRIMARY KEY (compte)
        )');
        $this->addSql('CREATE INDEX idx_sof_compte_douane_type ON sof_compte_douane (type)');

        $lignes = [
            ['DOUANE_A_CREDIT', '4784-101', 'REC DOUANE A CRD OWENDO'],
            ['DOUANE_A_CREDIT', '4784-102', 'REC DOUANE A CRD LBV-AEROPORT'],
            ['DOUANE_A_CREDIT', '4784-103', 'REC DOUANE A CRD PORT-GENTIL'],
            ['DOUANE_A_CREDIT', '4784-104', 'REC DOUANE A CRD AEROPORT POG'],
            ['DOUANE_A_CREDIT', '4784-105', 'RECDOUANE A CRD LBV PORT-MOLE'],
            ['DOUANE_A_CREDIT', '4784-106', 'REC DOUANE A CRD MOANDA'],
            ['DOUANE_A_CREDIT', '4784-107', 'DOUANE A CREDIT TRI POSTAL'],
            ['DOUANE_A_CREDIT', '4784-108', 'REC DOUANE A CRD MAYUMBA'],
            ['DOUANE_A_CREDIT', '4784-109', 'REC DOUANE A CRD NKOK'],
            ['DOUANE_A_CREDIT', '4784-111', 'DOUANE A CRD NEW INT PORT'],
            ['DOUANE_AU_COMPTANT', '4784-201', 'DOUANE AU COMPTANT OWENDO'],
            ['DOUANE_AU_COMPTANT', '4784-202', 'DOUANE AU COMPTANT LBV-AEROPORT'],
            ['DOUANE_AU_COMPTANT', '4784-203', 'DOUANE AU COMPTANT PORT POG'],
            ['DOUANE_AU_COMPTANT', '4784-204', 'DOUANE AU COMPTANT AEROPORT POG'],
            ['DOUANE_AU_COMPTANT', '4784-205', 'DOUANE AU COMPTANT PORT MOLE'],
            ['DOUANE_AU_COMPTANT', '4784-206', 'DOUANE AU COMPTANT MOANDA'],
            ['DOUANE_AU_COMPTANT', '4784-207', 'DOUANE AU COMPTANT TRI POSTAL'],
            ['DOUANE_AU_COMPTANT', '4784-208', 'DOUANE AU COMPTANT MAYUMBA'],
            ['DOUANE_AU_COMPTANT', '4784-209', 'DOUANE AU COMPTANT NKOK'],
            ['DOUANE_AU_COMPTANT', '4784-211', 'DOUANE AU COMPTANT NEW INT PORT'],
            ['DOUANE_MANUELLE', '4784-31', 'DOUANE MANUELLE'],
            ['RUSID', '4663-218', 'RUSID'],
            ['COMPTE_DE_TRANSFERT', '1812-101', 'Transfert de Recettes douanes OWENDO'],
            ['COMPTE_DE_TRANSFERT', '1812-102', 'Transfert de Recettes douanes AEROPORT LBV'],
            ['COMPTE_DE_TRANSFERT', '1812-103', 'Transfert de Recettes douanes POG'],
            ['COMPTE_DE_TRANSFERT', '1812-104', 'Transfert de Recettes douanes PORT-MOLE'],
            ['COMPTE_DE_TRANSFERT', '1812-105', 'Transfert de Recettes douanes CENTRE DE TRI'],
            ['COMPTE_DE_TRANSFERT', '1812-106', 'Transfert de Recettes douanes Moanda'],
            ['COMPTE_DE_TRANSFERT', '1812-107', 'Transfert de Recettes douane New Owendo Port'],
            ['COMPTE_DE_TRANSFERT', '1812-111', 'Transfert de Recettes douanes Nouveau Port Owendo'],
        ];

        foreach ($lignes as [$type, $compte, $libelle]) {
            $this->addSql(
                'INSERT INTO sof_compte_douane (compte, type, libelle_compte) VALUES (:compte, :type, :libelle)',
                ['compte' => $compte, 'type' => $type, 'libelle' => $libelle],
            );
        }
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP TABLE sof_compte_douane');
    }
}
