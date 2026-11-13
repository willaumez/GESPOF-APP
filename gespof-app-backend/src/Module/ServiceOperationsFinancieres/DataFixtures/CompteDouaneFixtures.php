<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\DataFixtures;

use App\Module\ServiceOperationsFinancieres\Entite\Recette\CompteDouane;
use App\Module\ServiceOperationsFinancieres\Enum\TypeCompteDouane;
use Doctrine\Persistence\ObjectManager;

/**
 * Référentiel des comptes douaniers (modèle automatisé recettes douanières).
 */
final class CompteDouaneFixtures
{
    /** @var list<array{0: TypeCompteDouane, 1: string, 2: string}> */
    private const COMPTES = [
        [TypeCompteDouane::DOUANE_A_CREDIT, '4784-101', 'REC DOUANE A CRD OWENDO'],
        [TypeCompteDouane::DOUANE_A_CREDIT, '4784-102', 'REC DOUANE A CRD LBV-AEROPORT'],
        [TypeCompteDouane::DOUANE_A_CREDIT, '4784-103', 'REC DOUANE A CRD PORT-GENTIL'],
        [TypeCompteDouane::DOUANE_A_CREDIT, '4784-104', 'REC DOUANE A CRD AEROPORT POG'],
        [TypeCompteDouane::DOUANE_A_CREDIT, '4784-105', 'RECDOUANE A CRD LBV PORT-MOLE'],
        [TypeCompteDouane::DOUANE_A_CREDIT, '4784-106', 'REC DOUANE A CRD MOANDA'],
        [TypeCompteDouane::DOUANE_A_CREDIT, '4784-107', 'DOUANE A CREDIT TRI POSTAL'],
        [TypeCompteDouane::DOUANE_A_CREDIT, '4784-108', 'REC DOUANE A CRD MAYUMBA'],
        [TypeCompteDouane::DOUANE_A_CREDIT, '4784-109', 'REC DOUANE A CRD NKOK'],
        [TypeCompteDouane::DOUANE_A_CREDIT, '4784-111', 'DOUANE A CRD NEW INT PORT'],
        [TypeCompteDouane::DOUANE_A_CREDIT, '4784-112', 'DOUANE A CRD BITAM'],
        [TypeCompteDouane::DOUANE_A_CREDIT, '4784-113', 'DOUANE A CRD OYEM'],
        [TypeCompteDouane::DOUANE_AU_COMPTANT, '4784-201', 'DOUANE AU COMPTANT OWENDO'],
        [TypeCompteDouane::DOUANE_AU_COMPTANT, '4784-202', 'DOUANE AU COMPTANT LBV-AEROPORT'],
        [TypeCompteDouane::DOUANE_AU_COMPTANT, '4784-203', 'DOUANE AU COMPTANT PORT POG'],
        [TypeCompteDouane::DOUANE_AU_COMPTANT, '4784-204', 'DOUANE AU COMPTANT AEROPORT POG'],
        [TypeCompteDouane::DOUANE_AU_COMPTANT, '4784-205', 'DOUANE AU COMPTANT PORT MOLE'],
        [TypeCompteDouane::DOUANE_AU_COMPTANT, '4784-206', 'DOUANE AU COMPTANT MOANDA'],
        [TypeCompteDouane::DOUANE_AU_COMPTANT, '4784-207', 'DOUANE AU COMPTANT TRI POSTAL'],
        [TypeCompteDouane::DOUANE_AU_COMPTANT, '4784-208', 'DOUANE AU COMPTANT MAYUMBA'],
        [TypeCompteDouane::DOUANE_AU_COMPTANT, '4784-209', 'DOUANE AU COMPTANT NKOK'],
        [TypeCompteDouane::DOUANE_AU_COMPTANT, '4784-211', 'DOUANE AU COMPTANT NEW INT PORT'],
        [TypeCompteDouane::DOUANE_AU_COMPTANT, '4784-212', 'DOUANE AU COMPTANT BITAM'],
        [TypeCompteDouane::DOUANE_AU_COMPTANT, '4784-213', 'DOUANE AU COMPTANT OYEM'],
        [TypeCompteDouane::DOUANE_MANUELLE, '4784-31', 'DOUANE MANUELLE'],
        [TypeCompteDouane::RUSID, '4663-218', 'RUSID'],
        [TypeCompteDouane::COMPTE_DE_TRANSFERT, '1812-101', 'Transfert de Recettes douanes OWENDO'],
        [TypeCompteDouane::COMPTE_DE_TRANSFERT, '1812-102', 'Transfert de Recettes douanes AEROPORT LBV'],
        [TypeCompteDouane::COMPTE_DE_TRANSFERT, '1812-103', 'Transfert de Recettes douanes POG'],
        [TypeCompteDouane::COMPTE_DE_TRANSFERT, '1812-104', 'Transfert de Recettes douanes PORT-MOLE'],
        [TypeCompteDouane::COMPTE_DE_TRANSFERT, '1812-105', 'Transfert de Recettes douanes CENTRE DE TRI'],
        [TypeCompteDouane::COMPTE_DE_TRANSFERT, '1812-106', 'Transfert de Recettes douanes Moanda'],
        [TypeCompteDouane::COMPTE_DE_TRANSFERT, '1812-107', 'Transfert de Recettes douane New Owendo Port'],
        [TypeCompteDouane::COMPTE_DE_TRANSFERT, '1812-111', 'Transfert de Recettes douanes Nouveau Port Owendo'],
    ];

    public function charger(ObjectManager $manager): void
    {
        foreach (self::COMPTES as [$type, $compte, $libelle]) {
            $existant = $manager->find(CompteDouane::class, $compte);
            if ($existant instanceof CompteDouane) {
                $existant->setType($type);
                $existant->setLibelleCompte($libelle);
                continue;
            }

            $manager->persist(new CompteDouane($type, $compte, $libelle));
        }
    }
}
