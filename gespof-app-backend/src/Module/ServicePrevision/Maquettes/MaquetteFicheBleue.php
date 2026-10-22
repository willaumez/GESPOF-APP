<?php

declare(strict_types=1);

namespace App\Module\ServicePrevision\Maquettes;

use App\Module\ServicePrevision\Enum\TypeSection;

/**
 * Maquette canonique de la Fiche Bleue : SOLDE + RECETTES + DÉPENSES.
 * Sert à pré-remplir la bibliothèque des sections et, par copie, la
 * composition d'une fiche à la création.
 *
 * Chaque nœud : libelle, sous_sections?. Les racines portent un type
 * (solde | recette | depense) hérité par toute la branche.
 */
final class MaquetteFicheBleue
{
    public const NOM = 'Fiche Bleue — Situation de trésorerie';

    public const CREATEUR_SYSTEME = 'Système';

    public const ENTETE_DOCUMENT = [
        "Ministère de l'Economie, des Finances, de la Dette et des Participations, Chargé de la Lutte Contre la Vie Chère",
        'Secrétariat Général',
        'Direction Générale de la Comptabilité Publique et du Trésor',
        'Direction des Opérations Monétaires et Financières',
    ];

    public const TITRE_DOCUMENT = 'SITUATION DE TRESORERIE';

    public const COLONNES = ['BANCAIRE', 'PROGRAMMATION'];

    public const LIBELLE_SOLDE = "SOLDES BANCAIRES D'OUVERTURE";

    /** Anciens libellés de la racine Solde, encore présents en base. */
    public const LIBELLES_SOLDE_ANCIENS = [
        "SOLDE BANCAIRE D'ENTREE",
    ];

    public const LIBELLE_SOLDE_BEAC = 'SOLDE BEAC';

    public const LIBELLE_SOLDE_BGFI = 'SOLDE BGFI';

    /** @var array<string, string> */
    public const RENOMMAGES_SOLDE = [
        'SOLDE BGFI RG XAF' => self::LIBELLE_SOLDE_BGFI,
    ];

    /**
     * Arbre bibliothèque : Solde, gabarit de composition Fiche Bleue,
     * puis le catalogue Recette / Dépense. « RECETTES » et « DEPENSES »
     * ne sont pas des sections : ce sont les types métier.
     *
     * @return list<array{libelle: string, type: TypeSection, sous_sections: list<array<string, mixed>>}>
     */
    public static function arbre(): array
    {
        $composition = self::compositionParDefaut();
        $recettesGabarit = [];
        $depensesGabarit = [];
        foreach ($composition as $noeud) {
            if ($noeud['type'] === TypeSection::RECETTE) {
                $recettesGabarit[] = $noeud;
            } else {
                $depensesGabarit[] = $noeud;
            }
        }

        return [
            [
                'libelle' => self::LIBELLE_SOLDE,
                'type' => TypeSection::SOLDE,
                'sous_sections' => [
                    ['libelle' => self::LIBELLE_SOLDE_BEAC],
                    ['libelle' => self::LIBELLE_SOLDE_BGFI],
                ],
            ],
            ...$recettesGabarit,
            ...self::racinesDeType(self::recettesProgrammees(), TypeSection::RECETTE),
            ...$depensesGabarit,
            ...self::racinesDeType(self::depensesProgrammees(), TypeSection::DEPENSE),
        ];
    }

    /**
     * Gabarit affiché à la création d'une Fiche Bleue (pas tout le catalogue).
     *
     * @return list<array{libelle: string, type: TypeSection, sous_sections: list<array<string, mixed>>}>
     */
    public static function compositionParDefaut(): array
    {
        return [
            [
                'libelle' => '1-RECETTES PROGRAMMEES',
                'type' => TypeSection::RECETTE,
                'sous_sections' => [
                    ['libelle' => 'RECETTES PETROLIERES ET MINIERES'],
                    ['libelle' => 'RECETTES IMPÔTS ATTENDUES'],
                    ['libelle' => 'RECETTES IMPÔTS ATTENDUES (IS)'],
                ],
            ],
            [
                'libelle' => '2-OPERATIONS DE COMPENSATION',
                'type' => TypeSection::RECETTE,
                'sous_sections' => [
                    ['libelle' => 'COMPENSATIONS CHEQUES IMPOTS'],
                    ['libelle' => 'SNG PARTICIPANTS'],
                    ['libelle' => 'COMPENSE REGIONALE'],
                    ['libelle' => 'COUVERTURE COMPENS BILATERALE'],
                ],
            ],
            [
                'libelle' => '3-ENCAISSEMENT DES RECETTES AFFECTEES',
                'type' => TypeSection::RECETTE,
                'sous_sections' => [
                    ['libelle' => 'a-COUVERTURES DES AGENCES COMPTABLES'],
                    ['libelle' => 'b-DIVERSES RECETTES AFFECTEES'],
                ],
            ],
            [
                'libelle' => '1-DEPENSES PROGRAMMEES',
                'type' => TypeSection::DEPENSE,
                'sous_sections' => [
                    ['libelle' => 'a-PROGRAMMATION JOURNALIERE'],
                    ['libelle' => 'b-DEPENSES EN ATTENTE DE DEBITS'],
                ],
            ],
            [
                'libelle' => '2-DEPENSES NON PROGRAMMEES',
                'type' => TypeSection::DEPENSE,
                'sous_sections' => [],
            ],
            [
                'libelle' => '3-REVERSEMENT DES RECETTES AFFECTEES',
                'type' => TypeSection::DEPENSE,
                'sous_sections' => [],
            ],
            [
                'libelle' => 'DEPENSES DES POSTES COMPTABLES (CUT)',
                'type' => TypeSection::DEPENSE,
                'sous_sections' => [],
            ],
        ];
    }

    /**
     * Vrai si le libellé est uniquement le type (RECETTES / 1-RECETTES,
     * DEPENSES / 2-DEPENSES), pas une section comme « 1-RECETTES PROGRAMMEES ».
     */
    public static function estConteneurType(string $libelle, TypeSection $type, bool $estRacine): bool
    {
        $norm = self::normaliserLibelleConteneur($libelle);

        if ($type === TypeSection::RECETTE) {
            return ($estRacine && $norm === 'RECETTES') || $norm === '1-RECETTES';
        }

        if ($type === TypeSection::DEPENSE) {
            return ($estRacine && $norm === 'DEPENSES') || $norm === '2-DEPENSES';
        }

        return false;
    }

    /**
     * @param list<array<string, mixed>> $noeuds
     *
     * @return list<array{libelle: string, type: TypeSection, sous_sections: list<array<string, mixed>>}>
     */
    private static function racinesDeType(array $noeuds, TypeSection $type): array
    {
        $racines = [];
        foreach ($noeuds as $noeud) {
            $racines[] = [
                'libelle' => (string) ($noeud['libelle'] ?? ''),
                'type' => $type,
                'sous_sections' => $noeud['sous_sections'] ?? [],
            ];
        }

        return $racines;
    }

    private static function normaliserLibelleConteneur(string $libelle): string
    {
        $haut = mb_strtoupper(trim($libelle));
        $sansAccents = strtr($haut, [
            'À' => 'A', 'Á' => 'A', 'Â' => 'A', 'Ä' => 'A',
            'È' => 'E', 'É' => 'E', 'Ê' => 'E', 'Ë' => 'E',
            'Ì' => 'I', 'Í' => 'I', 'Î' => 'I', 'Ï' => 'I',
            'Ò' => 'O', 'Ó' => 'O', 'Ô' => 'O', 'Ö' => 'O',
            'Ù' => 'U', 'Ú' => 'U', 'Û' => 'U', 'Ü' => 'U',
            'Ç' => 'C', 'Œ' => 'OE', 'Æ' => 'AE',
        ]);
        $compact = preg_replace('/\s+/', ' ', $sansAccents) ?? $sansAccents;
        $tirets = preg_replace('/\s*-\s*/', '-', $compact) ?? $compact;

        return trim($tirets);
    }

    /**
     * @return list<array<string, mixed>>
     */
    public static function recettesProgrammees(): array
    {
        return [
            self::n('RECETTES PETROLIERES', ['RECETTES PETROLIERES']),
            self::n('RECETTES IMPOTS', [
                'RECETTES IMPOTS ATTENDUS',
                'RECETTES IMPOTS ATTENDUS (IS)',
                'COMPENSATIONS CHEQUES IMPOTS',
                'SNG PARTICIPANT',
                'SNG REGIONALE',
                'COUVERTURE COMPENS BILATERALE',
                'DIVIDENDES COMILOG',
                'PROFIT OIL',
                'DROITS DE SORTIE COMILOG',
                'EXCEDENT CITIBANK',
            ]),
            self::n('RECETTES DOUANES', [
                'RAR EFFETS DOUANES 10 (NET DE CDC)',
                'RAR EFFETS DOUANES 20 (NET DE CDC)',
                'RAR EFFETS DOUANES 30 (NET DE CDC)',
                'RECETTES DOUANIERES',
                'MORATOIRE',
            ]),
            self::n('EMISSION DE TITRES', [
                'RACHAT BTA ET OTA',
                'EMISSION DE BTA',
                'EMISSION DE OTA',
                'EMPRUNT OBLIGATAIRE',
                'SYNDICATION',
            ]),
            self::n('APPUI BUDGETAIRE', [
                'BAD', 'DIVIDENDES TOTAL', 'CITI', 'AFD', 'FMI',
            ]),
            self::n('COUVERTURES CUT'),
            self::n('COUVERTURES DES AGENCES COMPTABLES', [
                'ABT - CL',
                'ABT EPNIC',
                'ABT EPNIC - COUV SNG DEBITRICE',
                'AC ANBG',
                'CDC',
                'TDP',
            ]),
            self::n('RECETTES AFFECTEES'),
            self::n("DROITS D'ACCISES", [
                'LUTTE ANTI TABAC',
                'ONDSC',
                'FONDS STRATEGIQUE AGRICOLE',
                'FONDS DE DEVELOPPEMENT PECHE ET AQUACULTURE',
            ]),
            self::n('CFP (SOCIETE ALIMENTAIRE DE LA NOMBA)', [
                'CFP',
                'CFP (SOCIETE ALIMENTAIRE DE LA NOMBA)',
            ]),
            self::n('RUR', [
                'RUR (PETRO GABON)',
                'RUR (OLA ENERGY)',
                'RUR (GAB OIL)',
                'RUR (TOTAL MARKETING)',
                'RUR (VIVO ENERGY)',
                'RUR (ENGEN)',
            ]),
            self::n('AUTRES REVERSEMENTS', [
                'REJET VIREMENT',
                'REJET SALAIRE',
                'RETOUR DE FONDS',
                'REJET PENSION',
                'SUCCESSION',
                'RECETTES OLAM',
                'RAC',
                'CSEE - FNEE',
            ]),
        ];
    }

    /**
     * @return list<array<string, mixed>>
     */
    public static function depensesProgrammees(): array
    {
        return [
            self::n('Salaires', [
                'SOLDE', 'SALAIRES MONP', 'AUTRES RETENUES SOLDE', 'RETENUES SOLDE',
                'ONSFAG', 'AUTRES RETENUES', 'PPB', 'PRIMES COUR DES COMPTES',
                'PRIME DE SERVITUDE DIPLOMATIQUE (PSD)', 'PRIME SPECIFIQUE',
                'RETENUES CNAMGS SOLDE ET PENSIONS', 'RETENUES CNAMGS ET CNSS MONP',
                'RETENUES PPB', 'SALAIRE SAMU SOCIAL', 'SALAIRE SOGATRA',
                'SALAIRES ANPN', 'SALAIRES ONSFAG',
                'SALAIRES ORGANISMES ET AUTONOMIES DE GESTION', 'SALAIRES POSTBANK',
                'SALAIRES TRANSURB', 'PRIMES EAUX ET FORETS', 'RAPPELS SOLDE',
            ]),
            self::n('Institutions', [
                'ANAC', 'ASSEMBLEE NATIONALE', 'BCPSGE', 'CEDOC (DGDI)', 'CESEC',
                'CGE', 'CNC', 'CND', 'CNDH', 'CNLCEIL', 'CNPAT', 'CNPDCP',
                'CONSEIL CLIMAT', "CONSEIL D'ETAT", 'COUR CONSTITUTIONNELLE',
                'COUR DE CASSATION', 'COUR DES COMPTES', 'HAC',
                'INTENDANCE DES PALAIS', 'MAGISTRATURE', 'MEDIATURE DE LA REPUBLIQUE',
                'PRIMATURE/ VICE PRIMATURE', 'PRIMATURE/ SECRETARIAT GENERAL',
                'RP OKALA', 'SENAT', 'SGG', 'TS PRESIDENCE DE LA REPUBLIQUE',
                'CONSEIL SUPERIEUR DE LA MAGISTRATURE', 'INSTITUTIONS',
            ]),
            self::n('Pensions', [
                'PENSIONS', 'RETENUES SUR PENSIONS', 'REMBOURSEMENT PENSIONS',
                'RAPPEL PENSION', 'PROVISION RETRAITES SOGATRA',
            ]),
            self::n('Bourses', [
                'DEBITS ATTENDUS CAMPUS France', 'BOURSES', 'INFASS', 'ENS', 'IEF',
                'BOURSES DU SECONDAIRE',
            ]),
            self::n('Cnamgs', [
                'RETENUES SOLDE ET PENSIONS', 'RETENUES MONP', 'REVERSEMENTS',
                'DETTES CNAMGS',
            ]),
            self::n('Santé', [
                'ANTI RETROVIRAUX', 'ANTI TUBERCULEUX', "CENTRE D'AFFAIRES MEDICAL",
                'CENTRE DES MALADES MENTAUX (MELEN)', 'CENTRE NATIONAL HEMODIALYSE',
                'CHR MELEN', 'CHU ANGONDJE', 'CHU MEFJE', 'CHU OWENDO', 'CHUL',
                'CNTS', 'COORDINATION SANITAIRE ET GENERALE', 'CROIX ROUGE',
                'DG SANTE', "ECOLE D'APPLICATION DU SERVICE MILITAIRE", 'GERIATRIE',
                'GOUVERNANCE SANITAIRE', 'HOPITAL ALBERT SCHWEITZER',
                'HOPITAL DE CAMPAGNE', 'HOPITAL EGYPTO GABONAIS', 'HOPITAL NKEMBO',
                'HOPITAL SINO GABONAIS', 'HOPITAUX DE LIBREVILLE',
                'HOPITAUX MILITAIRES', 'INSTITUT DE CANCEROLOGIE',
                'LABORATOIRE GAHOUMA', 'LUTTE CONTRE LE SIDA', 'MEDECINS CUBAINS',
                'MINISTERE DE LA SANTE', 'OCOTBRE ROSE', 'PLAN SOCIAL',
                'JOURNEE MONDIALE DE LUTTE CONTRE LE SIDA', 'OPN', 'SAMU SOCIAL',
                'CENTRE NATIONAL TRANSFUSION SANGUINE (CNTS)',
                'FONCTIONNEMENT DES HOPITAUX', 'AUTRES',
            ]),
            self::n('Education', [
                'ECOLES CONVENTIONNEES', 'EDUCATION NATIONALE',
                'EXAMENS ET CONCOURS', "FRAIS D'ECOLAGE", 'GRAND COLLEGE DU GABON',
                'CEP ET BEPC 2025', 'BAC 2025', 'UNIVERSITES ET GRANDES ECOLES',
                'VACATIONS',
            ]),
            self::n('Projets prioritaires', [
                'Projet Prioritaire', 'Provision Retour de fonds Projet Graine',
            ]),
            self::n('Elections', [
                'CGE', 'COUR CONSTITUTIONNELLE', 'MULTIPRESS',
                "MINISTERE DE L'INTERIEUR", 'ELECTIONS', 'REFERENDUM',
            ]),
            self::n('Ordures Ménagères', [
                'Clean Africa', 'AMS (RML)', 'GPS', 'RP OKALA', 'AGLI', 'RMO',
                'GPS MANDJI',
            ]),
            self::n('Collectivites locales'),
            self::n('Dette extérieure', [
                'BID', 'AFRITAC', 'BDEAC', 'COMMISSIONS CRCT', 'CONTRIBUTION  GABAC',
                'COSUMAF', "débit d'office DTS", 'DEBITS ATTENDUS DETTE EXTERIEURE',
                'EOG', 'INTERETS EOG', 'EUROBOND', 'FIDA', 'INVOLYS', 'BAD',
                'REMBOURSEMENT BGFI', 'BANQUE MONDIALE', 'FMI', 'AFD', 'BEI',
                'BLUE LOAN', 'BLUE BOND', 'AUTRES',
            ]),
            self::n('Dette intérieure', [
                'AVANCE STATUTAIRE', 'CLUB DE LIBREVILLE',
                'DEBIT D\'OFFICE COMMISSION DE SURVEILLANCE MARCHES FINANCIERS',
                'DEBIT D\'OFFICE', 'DETTE MARCHE INTERIEUR', 'INTERETS ANNUEL OTA',
                'EOG', 'RESTRUCTURATION BGFI', 'INTERETS EOG', 'CAPITAL OTA',
                'RETOUR OTA / SYNDICATION', 'TDP', 'TRESOR DETTE/ ECOBANK',
            ]),
            self::n('Mission diplomatique', ['Paieries']),
            self::n('Dépenses CUT'),
            self::n('Remboursement des Titres Publics', [
                'REMBOURSEMENT BTA', 'REMBOURSEMENT OTA',
                'DEBIT D\'OFFICE INTERETS OTA',
                'DEBIT D\'OFFICE COMMISSION EMISSION DES BTA',
                'RACHATS TIRAGES OTA',
                'DEBIT D\'OFFICE COMMISSION EMISSION DES OTA',
            ]),
            self::n('Remboursement Facilités', [
                'REMBOURSEMENT FACILITE UBA',
                'REVERSEMENT  PABURC (APPUI BAD)',
                'REMBOURSEMENT FACILITE BGFI',
            ]),
            self::n('Dépenses sur recettes exceptionnelles', [
                'BUS', 'DEPENSES', 'ENKA', 'INTENDANCE DES PALAIS',
                'JOURNEE COMPTABLE', 'OLAM', 'PLAN SOCIAL',
                'PROJET SYDONIA DOUANES', 'SOCIETE CIVILE IMMOBILIERE',
                'TRANSPORT NATIONAL DU GABON BUS', 'VAMED',
            ]),
            self::n('Cotisations Internationales', [
                'ONU', 'CAMES', 'CEEAC (CCI)', 'CEMAC (TCI)',
                'Debit d\'office cotisations COSUMAF', 'OHADA', 'OMC', 'OMS',
                'OPEP', 'UNESCO', 'UNION AFRICAINE',
                'AUTRES COTISATIONS INTERNATIONALES',
            ]),
            self::n('Défense et Sécurité', [
                'ALIMENTATION DES FDS', 'ALIMENTATION DES PRISONS',
                'DEFENSE NATIONALE', 'CARBURANT', 'FDS', 'GR', 'HABILLEMENT GR',
                'SECURITE PENITENTIAIRE', 'GENDARMERIE NATIONALE',
                'LOYERS (HEDENIA)', 'FORCE DE POLICE NATIONALE', 'EQUIPEMENT GR',
                "MINISTERE DE L'INTERIEUR",
                'SECURISATION DES POSTES INTERIEURS :MINKEBE / ZONE D / BAYENDE',
                'MUTUELLE FORCE DE POLICE NATIONALE',
                'MUTUELLE SECURITE PENITANTIAIRE', 'PECULE GR', 'TENUES MILITAIRE',
                'SECURISATION', 'TS ARMEES', 'CONSEIL NATIONALE DE SECURITE',
                'ETAT MAJOR GENERAL DES FORCES ARMEES', 'COCHEF GR',
                'SAPEUR POMPIER',
            ]),
            self::n('Autres Opérations  (Souveraineté)', [
                'Autres opérations', 'Achat de devises',
                'CABINET P/C AUTRES OPERATIONS', 'CRATUR',
                'Provision Avion (Assurance aviation)', 'THERAPEUTES',
                'AVOCATS NATIONAUX (HONORAIRES)', 'PROGLIO', 'AJE',
                'DEMINAGE(DOSSIER PR)', 'AIRBUS PR',
            ]),
            self::n('Autres dépenses', [
                'REGULE RETOUR DE FONDS', 'REGULE REJETS SALAIRE',
                'REGULE REJETS VIREMENT', 'REGULE RETOUR PENSIONS',
                'REJETS CHEQUES', 'CDC (RVSMT SNG CREDITRICE)',
                'ABT EPNIC(RVSMT SNG CREDITRICE)', 'ABT CL (RVSMT SNG CREDITRICE)',
                'BAUX ADMINISTRATIFS', 'BST',
                'DPM/ DEPENSES DE FONCTIONNEMENT DGCPT', 'FRAIS',
                'APPUI A LA MOBILISATION DGCPT', 'APPUI A LA MOBILISATION DGDDI',
                'APPUI A LA MOBILISATION DGI', 'FRAIS DE MISSION',
                'INDUS A REMBOURSER', 'OPERATION DE LA CDC', 'DEPOTS TISPP2',
                'REMBOURSEMENT FACILITE ABT', 'APPRO GUICHET FAV TG',
                'APPRO GUICHET FAV ABT', 'AUTRES FONCTIONNEMENT ADMINISTRATION',
                'REMBOURSEMENT SPOT BGFI', 'REGUL SYSTAC',
                "MINISTERE DE L'ECONOMIE", 'CONTENTIEUX',
                'OPERATIONS DE L ANBG',
                'REMBOURSEMENT PRECOMPTE TVA OP 25006706',
                'SALAIRE CAONFED FEVRIER 2026', 'CABINET DES COMPTES PUBLICS',
                'JEUX DE LA FRACOPHONIE',
                'FESTIVITES OGOOUE IVINDO DU 30 AOUT 2026',
                'CHAMPIONNAT NATIONAL DE FOOTBALL', 'LBTPG',
                'DIVERS BENEFICIAIRES (REVERSEMENT DES CAUTIONS )',
                'PRELEVEMENT FRAIS LTD PC REVIVAL HOLDINGS',
                'VIREMENT TRESOR PORT-GENTIL', 'VIREMENT TRESOR FCV',
                'ASCR CONTRIBUTION CARBONE GABON',
                'CONTRIBUTION SEEG FAVEUR ARSEE',
                'CONTRIBUTION MINERAL PORT OWENDO FAVEUR MARINE MARCHANDE',
                'CONTRIBUTION VAALCO GABON FAVEUR ANINF', 'GABON 24',
                'FRAIS ET COMMISSIONS TRANSFERTS UNION AFRICAINE',
                'CENTRE DES METIERS DU BOIS DE NKOK', 'CABINET DU MINISTRE',
                'ABT COL (REVERSEMENT CONSEIL DEPARTEMENTAL DU WOLEU CHEQUES ENCAISSE)',
                'REGUL REVERSEMENT FONDS MAL ORIENTES DU 29 10 2025', 'OACI',
                'COMMISSION DE PLACEMENT OTA ET TITRISATION DES CREANCES SUR L ETAT DU GABON',
                "L'ENTREPRISE LE TISSERAND (DETTE PUBLIQUE)",
                'SOCIETE DE COMMERCE CONCEPTION MARKETING SCCM',
                'PRESTATION DE SERMENTS DES AGENTS COMPTABLES',
                'ARBRE DE NOEL DGBFIP 2025', 'FORMATION SIGPFIP', 'DGBFIP',
                'ASTREINTES MBCP', 'ISSR', 'AVANCE CNAMGS CAON FED',
                'ASTREINTE DBG TRAVAUX DU DECRETS 405', 'LOYER',
                "PENSIONS  DE L'ETRANGER", 'CNOU', 'AGP',
                'TELEDIFFUSION DU GABON',
                'ACTIVITES PREPARATOIRES DES EXAMENS 2026',
                'ORABANK (REMBOURSEMENT AVANCE SOLDE FEVRIER 2026)',
                'ALGEST (COMMISSIONS ET HONORAIRES A LA DGCPT)',
                'REVERSEMENT RECETTES DIVERSE ORABANK DU 02 09 2025',
                'AFG (REMBOURSEMENT AVANCE SOLDE JANVIER 2026)',
                'REVERSEMENT RECETTES AFFECTEES CONTENTIEUX DGCPT',
                'POMPES FUNEBRES (CASEPGA)',
                'GEOTOPO SERVICES CORPORATED (COLLECTE DES DONNEES )',
                'FRAIS MEDICAUX', 'TRAVAUX AMENAGEMENT VOIRIE FRANCEVILLE',
                'REGUL PRIME DE NOEL', 'THEATRE NATIONAL', 'MUSEE NATIONAL',
                "CREDITS D'APPUI AMBASSADE", 'BUGADAT',
            ]),
        ];
    }

    /**
     * @param list<string|array<string, mixed>> $enfants
     *
     * @return array<string, mixed>
     */
    private static function n(string $libelle, array $enfants = []): array
    {
        $sous = [];
        $vus = [];
        foreach ($enfants as $enfant) {
            $noeud = is_string($enfant)
                ? ['libelle' => trim(preg_replace('/\s+/', ' ', $enfant) ?? $enfant)]
                : $enfant;
            $cle = trim((string) ($noeud['libelle'] ?? ''));
            if ($cle === '' || isset($vus[$cle])) {
                continue;
            }
            $vus[$cle] = true;
            $noeud['libelle'] = $cle;
            $sous[] = $noeud;
        }

        $out = ['libelle' => $libelle];
        if ($sous !== []) {
            $out['sous_sections'] = $sous;
        }

        return $out;
    }
}
