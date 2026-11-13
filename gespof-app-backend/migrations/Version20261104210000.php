<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * SOF : référentiel comptes douanes/pétrole aligné manuel SROT p.24/27
 * + Bitam/Oyem (classeur RD Model Automatisé).
 */
final class Version20261104210000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'SOF : seed complet sof_compte_suivi (SROT + Bitam/Oyem) et compléments sof_compte_douane.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('DELETE FROM sof_compte_suivi');

        // nature « - » = non applicable (douanes) ; natures pétrolières = manuel p. 27
        // bancaire_seulement = true pour 4784-1* (règle SROT)
        $lignes = [
            // —— Douanes à crédit (classeur = manuel + Bitam/Oyem) ——
            ['4784-101', '-', 'REC DOUANE A CRD OWENDO', 'DOUANE', 'DOUANE A CRÉDIT', true, 1],
            ['4784-102', '-', 'REC DOUANE A CRD LBV-AEROPORT', 'DOUANE', 'DOUANE A CRÉDIT', true, 2],
            ['4784-103', '-', 'REC DOUANE A CRD PORT-GENTIL', 'DOUANE', 'DOUANE A CRÉDIT', true, 3],
            ['4784-104', '-', 'REC DOUANE A CRD AEROPORT POG', 'DOUANE', 'DOUANE A CRÉDIT', true, 4],
            ['4784-105', '-', 'RECDOUANE A CRD LBV PORT-MOLE', 'DOUANE', 'DOUANE A CRÉDIT', true, 5],
            ['4784-106', '-', 'REC DOUANE A CRD MOANDA', 'DOUANE', 'DOUANE A CRÉDIT', true, 6],
            ['4784-107', '-', 'DOUANE A CREDIT TRI POSTAL', 'DOUANE', 'DOUANE A CRÉDIT', true, 7],
            ['4784-108', '-', 'REC DOUANE A CRD MAYUMBA', 'DOUANE', 'DOUANE A CRÉDIT', true, 8],
            ['4784-109', '-', 'REC DOUANE A CRD NKOK', 'DOUANE', 'DOUANE A CRÉDIT', true, 9],
            ['4784-111', '-', 'DOUANE A CRD NEW INT PORT', 'DOUANE', 'DOUANE A CRÉDIT', true, 10],
            ['4784-112', '-', 'DOUANE A CRD BITAM', 'DOUANE', 'DOUANE A CRÉDIT', true, 11],
            ['4784-113', '-', 'DOUANE A CRD OYEM', 'DOUANE', 'DOUANE A CRÉDIT', true, 12],
            // —— Douanes au comptant ——
            ['4784-201', '-', 'DOUANE AU COMPTANT OWENDO', 'DOUANE', 'DOUANE AU COMPTANT', false, 13],
            ['4784-202', '-', 'DOUANE AU COMPTANT LBV-AEROPORT', 'DOUANE', 'DOUANE AU COMPTANT', false, 14],
            ['4784-203', '-', 'DOUANE AU COMPTANT PORT POG', 'DOUANE', 'DOUANE AU COMPTANT', false, 15],
            ['4784-204', '-', 'DOUANE AU COMPTANT AEROPORT POG', 'DOUANE', 'DOUANE AU COMPTANT', false, 16],
            ['4784-205', '-', 'DOUANE AU COMPTANT PORT MOLE', 'DOUANE', 'DOUANE AU COMPTANT', false, 17],
            ['4784-206', '-', 'DOUANE AU COMPTANT MOANDA', 'DOUANE', 'DOUANE AU COMPTANT', false, 18],
            ['4784-207', '-', 'DOUANE AU COMPTANT TRI POSTAL', 'DOUANE', 'DOUANE AU COMPTANT', false, 19],
            ['4784-208', '-', 'DOUANE AU COMPTANT MAYUMBA', 'DOUANE', 'DOUANE AU COMPTANT', false, 20],
            ['4784-209', '-', 'DOUANE AU COMPTANT NKOK', 'DOUANE', 'DOUANE AU COMPTANT', false, 21],
            ['4784-211', '-', 'DOUANE AU COMPTANT NEW INT PORT', 'DOUANE', 'DOUANE AU COMPTANT', false, 22],
            ['4784-212', '-', 'DOUANE AU COMPTANT BITAM', 'DOUANE', 'DOUANE AU COMPTANT', false, 23],
            ['4784-213', '-', 'DOUANE AU COMPTANT OYEM', 'DOUANE', 'DOUANE AU COMPTANT', false, 24],
            // —— Manuelle / RUSID / transferts ——
            ['4784-31', '-', 'DOUANE MANUELLE', 'DOUANE', 'DOUANE MANUELLE', false, 25],
            ['4663-218', '-', 'RUSID', 'DOUANE', 'RUSID', false, 26],
            ['1812-101', '-', 'Transfert de Recettes douanes OWENDO', 'DOUANE', 'COMPTE DE TRANSFERT', false, 27],
            ['1812-102', '-', 'Transfert de Recettes douanes AEROPORT LBV', 'DOUANE', 'COMPTE DE TRANSFERT', false, 28],
            ['1812-103', '-', 'Transfert de Recettes douanes POG', 'DOUANE', 'COMPTE DE TRANSFERT', false, 29],
            ['1812-104', '-', 'Transfert de Recettes douanes PORT-MOLE', 'DOUANE', 'COMPTE DE TRANSFERT', false, 30],
            ['1812-105', '-', 'Transfert de Recettes douanes CENTRE DE TRI', 'DOUANE', 'COMPTE DE TRANSFERT', false, 31],
            ['1812-106', '-', 'Transfert de Recettes douanes Moanda', 'DOUANE', 'COMPTE DE TRANSFERT', false, 32],
            ['1812-107', '-', 'Transfert de Recettes douane New Owendo Port', 'DOUANE', 'COMPTE DE TRANSFERT', false, 33],
            ['1812-111', '-', 'Transfert de Recettes douanes Nouveau Port Owendo', 'DOUANE', 'COMPTE DE TRANSFERT', false, 34],
            // —— Pétrole (manuel SROT p. 27) ——
            ['1812-219', '1', 'IS Transferts', 'PETROLE', 'IS', false, 35],
            ['4781-11', '4', 'IS Régularisé', 'PETROLE', 'IS', false, 36],
            ['4781-12', '4', 'IS Contentieux', 'PETROLE', 'IS', false, 37],
            ['4783-1', '23', 'Dividendes', 'PETROLE', 'Dividendes', false, 38],
            ['4783-2', '23', 'Dividendes Contentieux', 'PETROLE', 'Dividendes', false, 39],
            ['4783-1', '1', 'RMP', 'PETROLE', 'RMP', false, 40],
            ['4751-101', '4', 'RMP Gaz', 'PETROLE', 'RMP', false, 41],
            ['4783-2', '1', 'RMP Contentieux', 'PETROLE', 'RMP', false, 42],
            ['4783-1', '6', 'Redevance Superficiaire', 'PETROLE', 'Redevance Superficiaire', false, 43],
            ['4783-2', '6', 'Redevance Superficiaire Contentieux', 'PETROLE', 'Redevance Superficiaire', false, 44],
            ['4751-101', '2', 'Profit Oil', 'PETROLE', 'Profit Oil', false, 45],
            ['4751-101', '3', 'Discount et Boni', 'PETROLE', 'Discount et Boni', false, 46],
            ['4751-101', '7', 'Discount et Boni', 'PETROLE', 'Discount et Boni', false, 47],
            ['4751-227', '27', 'Autres recettes pétrolières', 'PETROLE', 'PIPES', false, 48],
            // —— Transferts pétroliers (manuel p. 26, hors tableau p. 27) ——
            ['1812-201', '-', 'Transferts pétroliers (numéraire et bancaire)', 'PETROLE', 'Transferts', false, 49],
        ];

        foreach ($lignes as [$compte, $nature, $libelle, $famille, $type, $bancaire, $ordre]) {
            $bancaireSql = $bancaire ? 'TRUE' : 'FALSE';
            $this->addSql(
                "INSERT INTO sof_compte_suivi (compte, nature, libelle, famille, type, bancaire_seulement, ordre)
                 VALUES (?, ?, ?, ?, ?, {$bancaireSql}, ?)",
                [$compte, $nature, $libelle, $famille, $type, $ordre],
            );
        }

        // Compléments Bitam / Oyem sur le référentiel douanes métier
        $douanesExtra = [
            ['4784-112', 'DOUANE_A_CREDIT', 'DOUANE A CRD BITAM'],
            ['4784-113', 'DOUANE_A_CREDIT', 'DOUANE A CRD OYEM'],
            ['4784-212', 'DOUANE_AU_COMPTANT', 'DOUANE AU COMPTANT BITAM'],
            ['4784-213', 'DOUANE_AU_COMPTANT', 'DOUANE AU COMPTANT OYEM'],
        ];
        foreach ($douanesExtra as [$compte, $type, $libelle]) {
            $this->addSql(
                "INSERT INTO sof_compte_douane (compte, type, libelle_compte, actif)
                 SELECT ?, ?, ?, TRUE
                 WHERE NOT EXISTS (SELECT 1 FROM sof_compte_douane WHERE compte = ?)",
                [$compte, $type, $libelle, $compte],
            );
        }
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DELETE FROM sof_compte_suivi');

        // Restaure le seed maquette minimal (Version20261104170000)
        $lignes = [
            ['4784-101', '71', 'Douanes · recettes à crédit', 'DOUANE', 'À crédit', true, 1],
            ['4784-102', '72', 'Douanes · recettes à crédit Owendo', 'DOUANE', 'À crédit', true, 2],
            ['4784-201', '73', 'Douanes · comptant', 'DOUANE', 'Au comptant', false, 3],
            ['4784-31', '74', 'Douanes · manuelle', 'DOUANE', 'Au comptant', false, 4],
            ['4781-11', '75', 'Pétrole · RMP', 'PETROLE', 'RMP', false, 5],
            ['4781-12', '76', 'Pétrole · IS', 'PETROLE', 'IS', false, 6],
            ['4783-1', '77', 'Pétrole · dividendes', 'PETROLE', 'Dividendes', false, 7],
        ];
        foreach ($lignes as [$compte, $nature, $libelle, $famille, $type, $bancaire, $ordre]) {
            $bancaireSql = $bancaire ? 'TRUE' : 'FALSE';
            $this->addSql(
                "INSERT INTO sof_compte_suivi (compte, nature, libelle, famille, type, bancaire_seulement, ordre)
                 VALUES (?, ?, ?, ?, ?, {$bancaireSql}, ?)",
                [$compte, $nature, $libelle, $famille, $type, $ordre],
            );
        }

        $this->addSql(
            "DELETE FROM sof_compte_douane WHERE compte IN ('4784-112', '4784-113', '4784-212', '4784-213')",
        );
    }
}
