<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * SOF phase 0 : table societe_petroliere + seed maquette.
 */
final class Version20261104180000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'SOF : sof_societe_petroliere (matricule PK) + données initiales SOCIETES.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
            CREATE TABLE sof_societe_petroliere (
                matricule VARCHAR(32) NOT NULL,
                nom VARCHAR(255) NOT NULL,
                champ_nif VARCHAR(64) DEFAULT NULL,
                redevance_sup_min NUMERIC(20, 2) DEFAULT 0 NOT NULL,
                petrole BOOLEAN DEFAULT TRUE NOT NULL,
                PRIMARY KEY (matricule)
            )
        SQL);

        // Maquette D.SOC + matricules 400100 + i*37 ; dernier = Hors pétrole
        $lignes = [
            ['400100', 'Perenco Oil & Gas Gabon', '012457 K', '300000000.00', true],
            ['400137', 'TotalEnergies EP Gabon', '004218 A', '300000000.00', true],
            ['400174', 'Assala Energy', '021390 M', '300000000.00', true],
            ['400211', 'Maurel & Prom Gabon', '009871 C', '300000000.00', true],
            ['400248', 'Addax Petroleum', '015532 F', '300000000.00', true],
            ['400285', 'VAALCO Gabon', '018804 B', '300000000.00', false],
        ];

        foreach ($lignes as [$matricule, $nom, $champNif, $redevance, $petrole]) {
            $petroleSql = $petrole ? 'TRUE' : 'FALSE';
            $this->addSql(
                "INSERT INTO sof_societe_petroliere (matricule, nom, champ_nif, redevance_sup_min, petrole)
                 VALUES (?, ?, ?, ?, {$petroleSql})",
                [$matricule, $nom, $champNif, $redevance],
            );
        }
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP TABLE sof_societe_petroliere');
    }
}
