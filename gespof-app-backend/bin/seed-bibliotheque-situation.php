<?php

declare(strict_types=1);

/**
 * Remplace le contenu de bibliotheque_section par l'arborescence
 * « Situation de trésorerie » (soldes / recettes / dépenses / provisions).
 *
 * Usage (depuis gespof-app-backend) :
 *   php bin/seed-bibliotheque-situation.php
 */

use App\Kernel;
use App\Module\ServicePrevision\Entite\FicheBleu\BibliothequeSection;
use App\Module\ServicePrevision\Enum\TypeSection;
use Symfony\Component\Dotenv\Dotenv;

require dirname(__DIR__) . '/vendor/autoload.php';

(new Dotenv())->bootEnv(dirname(__DIR__) . '/.env');

$kernel = new Kernel($_SERVER['APP_ENV'], (bool) $_SERVER['APP_DEBUG']);
$kernel->boot();

/** @var \Doctrine\ORM\EntityManagerInterface $em */
$em = $kernel->getContainer()->get('doctrine')->getManager();
$conn = $em->getConnection();

$createur = 'Système';

/**
 * Arbre : [libelle, type, enfants?]
 * type uniquement sur les racines ; les enfants héritent.
 *
 * @var list<array{0: string, 1: TypeSection, 2?: list<mixed>}>
 */
$arbre = [
    [
        'SOLDES BANCAIRES D\'OUVERTURE',
        TypeSection::SOLDE,
        [
            ['SOLDE BEAC'],
            ['SOLDE BGFI'],
        ],
    ],
    [
        'RECETTES EN COURS D\'ENCAISSEMENT',
        TypeSection::RECETTE,
        [
            [
                'Compensation des chèques (centres des impôts)',
                [
                    ['Trésorerie centrale'],
                    ['Direction des Grandes Entreprises (DGE)'],
                    ['Centre des impôts POG'],
                ],
            ],
            ['Effets douanes du 10 mars 2026'],
            ['Effets douanes du 20 mars 2026'],
        ],
    ],
    [
        'RECETTES AFFECTÉES',
        TypeSection::RECETTE,
        [
            [
                'Recettes affectées',
                [
                    ['Recettes affectées'],
                    ['ABT'],
                ],
            ],
            ['Recettes affectées BGFI'],
        ],
    ],
    [
        'DÉPENSES EN ATTENTE DE DÉBITS',
        TypeSection::DEPENSE,
        [
            [
                'Dette extérieure',
                [
                    ['Dette chinoise (dossier Norenco)'],
                ],
            ],
            [
                'Produit des BTA / OTA',
                [
                    ['Produit des OTA du 13/03/2026'],
                ],
            ],
            [
                'Dette intérieure',
                [
                    ['Remboursement intérêts annuels OTA du 23/02/2026 (reliquat)'],
                    ['Remboursement OTA du 17/02/2026 (reliquat)'],
                    ['Provision EOG du 23/03/2026'],
                    ['Remboursement BTA du 20/03/2026'],
                    ['Remboursement BTA UGB du 20/03/2027'],
                ],
            ],
            [
                'Paieries',
                [
                    ['Missions diplomatiques'],
                    ['Frais de santé du personnel diplomatique'],
                    ['Appro États-Unis'],
                ],
            ],
            [
                'Paierie du Gabon en France',
                [
                    ['Rapatriement des diplomates'],
                    ['Loyers des ambassades'],
                ],
            ],
            [
                'Cotisations internationales',
                [
                    ['OPEP'],
                ],
            ],
            [
                'Autres dépenses',
                [
                    ['Honoraires conseils prêt Cargill'],
                    ['AC CNAMGS (centrales à oxygène)'],
                ],
            ],
        ],
    ],
    [
        'SOLDE NET DES RECETTES AFFECTÉES ET DES DÉBITS ATTENDUS',
        TypeSection::SOLDE,
    ],
    [
        'PROVISIONS / PROGRAMMATIONS',
        TypeSection::DEPENSE,
        [
            ['Matchs Panthères'],
            ['Concours de l\'artisanat'],
            ['Reversement recettes affectées contentieux DGCPT'],
            ['Travaux préparatoires examens enseignement technique'],
            ['Auxiliaires sécurité scolaire'],
            ['Journée comptable'],
            ['Contentieux Rockover mars 2026 - part DGCPT'],
        ],
    ],
];

/**
 * @param list<mixed> $enfants
 */
function construireEnfants(
    BibliothequeSection $parent,
    array $enfants,
    string $createur,
): void {
    $ordre = 1;
    foreach ($enfants as $noeud) {
        $libelle = (string) $noeud[0];
        $sous = $noeud[1] ?? [];
        $enfant = new BibliothequeSection($libelle, $createur, $parent->getType());
        $enfant->setOrdre($ordre++);
        $parent->ajouterSousSection($enfant);
        if (is_array($sous) && $sous !== []) {
            construireEnfants($enfant, $sous, $createur);
        }
    }
}

$conn->executeStatement('TRUNCATE TABLE bibliotheque_section RESTART IDENTITY CASCADE');

$ordreRacine = 1;
foreach ($arbre as $racineDef) {
    $libelle = (string) $racineDef[0];
    /** @var TypeSection $type */
    $type = $racineDef[1];
    $enfants = $racineDef[2] ?? [];

    $racine = new BibliothequeSection($libelle, $createur, $type);
    $racine->setOrdre($ordreRacine++);
    $em->persist($racine);

    if (is_array($enfants) && $enfants !== []) {
        construireEnfants($racine, $enfants, $createur);
    }
}

$em->flush();

$total = (int) $conn->fetchOne('SELECT COUNT(*) FROM bibliotheque_section');
$racines = (int) $conn->fetchOne(
    'SELECT COUNT(*) FROM bibliotheque_section WHERE section_parente_id IS NULL',
);

echo sprintf(
    "Bibliothèque rechargée : %d sections (%d racines).\n",
    $total,
    $racines,
);
