<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Extraction;

/**
 * Registre déclaratif des presets d'extraction DC / IG.
 */
final class ExtractionRegistry
{
    /** @var list<ExtractionDefinition>|null */
    private ?array $definitions = null;

    /**
     * @return list<ExtractionDefinition>
     */
    public function toutes(): array
    {
        return $this->definitions ??= $this->construire();
    }

    public function trouver(string $code): ?ExtractionDefinition
    {
        foreach ($this->toutes() as $def) {
            if ($def->code === $code) {
                return $def;
            }
        }

        return null;
    }

    /**
     * @return list<array{id: string, libelle: string}>
     */
    public function familles(): array
    {
        return [
            ['id' => 'ig-operations', 'libelle' => 'IG · Opérations'],
            ['id' => 'ig-recaps', 'libelle' => 'IG · Récapitulatifs'],
            ['id' => 'dc-reglements', 'libelle' => 'DC · Règlements'],
            ['id' => 'dc-rap', 'libelle' => 'DC · Restes à payer'],
            ['id' => 'dc-ordonnances', 'libelle' => 'DC · Ordonnances et crédits délégués'],
        ];
    }

    /**
     * Ordre « Extraire tout » (hors préparation / finalisation).
     *
     * @return list<string>
     */
    public function ordreExtraireTout(): array
    {
        return [
            'ig-cdel-4742',
            'ig-avances-etat',
            'ig-avances-postes',
            'ig-tva',
            'ig-douanes',
            'ig-petrole-1812-201',
            'ig-petrole-comptes',
            'ig-mvm-fe',
            'ig-recettes-fiscales',
            'ig-beac',
            'ig-rusid',
            'ig-rcdd',
            'dc-xrgv',
            'dc-xrgm-tva',
            'dc-xrav',
            'dc-xram-tva',
            'dc-rap-avant-bop',
            'dc-xlop',
            'dc-cdel',
        ];
    }

    /**
     * @return list<ExtractionDefinition>
     */
    private function construire(): array
    {
        $petroleCouples = [
            ['compte' => '1812-219', 'nature' => 1, 'libelle' => 'IS Transferts'],
            ['compte' => '4781-11', 'nature' => 4, 'libelle' => 'IS Régularisé'],
            ['compte' => '4781-12', 'nature' => 4, 'libelle' => 'IS Contentieux'],
            ['compte' => '4783-1', 'nature' => 23, 'libelle' => 'Dividendes'],
            ['compte' => '4783-2', 'nature' => 23, 'libelle' => 'Dividendes Contentieux'],
            ['compte' => '4783-1', 'nature' => 1, 'libelle' => 'RMP'],
            ['compte' => '4751-101', 'nature' => 4, 'libelle' => 'RMP Gaz'],
            ['compte' => '4783-2', 'nature' => 1, 'libelle' => 'RMP Contentieux'],
            ['compte' => '4783-1', 'nature' => 6, 'libelle' => 'Redevance Superficiaire'],
            ['compte' => '4783-2', 'nature' => 6, 'libelle' => 'Redevance Superficiaire Contentieux'],
            ['compte' => '4751-101', 'nature' => 2, 'libelle' => 'Profit Oil'],
            ['compte' => '4751-101', 'nature' => 3, 'libelle' => 'Discount et Boni'],
            ['compte' => '4751-101', 'nature' => 7, 'libelle' => 'Discount et Boni'],
            ['compte' => '4751-227', 'nature' => 27, 'libelle' => 'Autres recettes pétrolières'],
        ];

        return [
            // —— IG · Opérations (VIDR / F1) ——
            new ExtractionDefinition(
                code: 'ig-cdel-4742',
                libelle: 'Crédits délégués (4742-)',
                source: SourceExtraction::IG,
                famille: 'ig-operations',
                domaine: DomaineExtraction::DEPENSES,
                ecran: 'VIDR',
                format: 'F1',
                sqlFile: 'ig-operations-vidr.sql',
                periode: PeriodeParDefaut::EXERCICE_A_DATE,
                refManuel: 'SROT p. 11-12',
                comptes: ['4742-%'],
                sourceLot: 'ig-cdel',
            ),
            new ExtractionDefinition(
                code: 'ig-avances-etat',
                libelle: 'Avances au budget de l\'État (4701-5)',
                source: SourceExtraction::IG,
                famille: 'ig-operations',
                domaine: DomaineExtraction::DEPENSES,
                ecran: 'VIDR',
                format: 'F1',
                sqlFile: 'ig-operations-vidr.sql',
                periode: PeriodeParDefaut::EXERCICE_A_DATE,
                refManuel: 'SROT p. 13-14',
                comptes: ['4701-5%'],
                sourceLot: 'ig-avances-4701',
            ),
            new ExtractionDefinition(
                code: 'ig-avances-postes',
                libelle: 'Avances au budget des postes comptables (4706-1)',
                source: SourceExtraction::IG,
                famille: 'ig-operations',
                domaine: DomaineExtraction::DEPENSES,
                ecran: 'VIDR',
                format: 'F1',
                sqlFile: 'ig-operations-vidr.sql',
                periode: PeriodeParDefaut::EXERCICE_A_DATE,
                refManuel: 'SROT p. 14',
                comptes: ['4706-1%'],
                sourceLot: 'ig-avances-4706',
            ),
            new ExtractionDefinition(
                code: 'ig-tva',
                libelle: 'Règlements TVA IG (4781-31, nature 81)',
                source: SourceExtraction::IG,
                famille: 'ig-operations',
                domaine: DomaineExtraction::RECETTES,
                ecran: 'VIDR',
                format: 'F1',
                sqlFile: 'ig-operations-vidr.sql',
                periode: PeriodeParDefaut::EXERCICE_A_DATE,
                refManuel: 'SROT p. 13',
                comptes: ['4781-31'],
                natures: [81],
                sourceLot: 'ig-tva',
            ),
            new ExtractionDefinition(
                code: 'ig-douanes',
                libelle: 'Recettes douanières',
                source: SourceExtraction::IG,
                famille: 'ig-operations',
                domaine: DomaineExtraction::RECETTES,
                ecran: 'VIDR',
                format: 'F1',
                sqlFile: 'model-automatise-recettes-douanieres.sql',
                periode: PeriodeParDefaut::MOIS,
                refManuel: 'SROT p. 24-25',
                typesOperation: ['X', 'S'],
                sourceLot: 'ig-douanes',
            ),
            new ExtractionDefinition(
                code: 'ig-petrole-1812-201',
                libelle: 'Transferts pétroliers (1812-201)',
                source: SourceExtraction::IG,
                famille: 'ig-operations',
                domaine: DomaineExtraction::RECETTES,
                ecran: 'VIDR',
                format: 'F1',
                sqlFile: 'model-automatise-recettes-petroliere-1812-201.sql',
                periode: PeriodeParDefaut::MOIS,
                refManuel: 'SROT p. 26',
                comptes: ['1812-201'],
                sourceLot: 'ig-petrole',
            ),
            new ExtractionDefinition(
                code: 'ig-petrole-comptes',
                libelle: 'Recettes pétrolières par compte',
                source: SourceExtraction::IG,
                famille: 'ig-operations',
                domaine: DomaineExtraction::RECETTES,
                ecran: 'VIDR',
                format: 'F1',
                sqlFile: 'model-automatise-recettes-petroliere-etat-par-compte.sql',
                periode: PeriodeParDefaut::MOIS,
                refManuel: 'SROT p. 27',
                couplesCompteNature: $petroleCouples,
                sourceLot: 'ig-petrole',
            ),
            new ExtractionDefinition(
                code: 'ig-mvm-fe',
                libelle: 'Mouvements de fonds et effets',
                source: SourceExtraction::IG,
                famille: 'ig-operations',
                domaine: DomaineExtraction::RECETTES,
                ecran: 'VIDR',
                format: 'F1',
                sqlFile: 'mouvements-fonds-effets-vidr.sql',
                periode: PeriodeParDefaut::EXERCICE_A_DATE,
                disponible: false,
                motifIndisponible: 'requête non disponible',
                sourceLot: 'srv-mvm-fe',
            ),
            new ExtractionDefinition(
                code: 'ig-recettes-fiscales',
                libelle: 'Recettes fiscales (1812, 4781, 4783)',
                source: SourceExtraction::IG,
                famille: 'ig-operations',
                domaine: DomaineExtraction::RECETTES,
                ecran: 'VIDR',
                format: 'F1',
                sqlFile: 'recettes-fiscales-1812-4781-4783-vidr.sql',
                periode: PeriodeParDefaut::EXERCICE_A_DATE,
                comptes: ['1812%', '4781%', '4783%'],
                disponible: false,
                motifIndisponible: 'requête non disponible',
                sourceLot: 'ig-fiscal',
            ),

            // —— IG · Récapitulatifs ——
            new ExtractionDefinition(
                code: 'ig-beac',
                libelle: 'Récapitulatif des recettes BEAC',
                source: SourceExtraction::IG,
                famille: 'ig-recaps',
                domaine: DomaineExtraction::RECETTES,
                ecran: 'REC_BEAC',
                format: 'F7',
                sqlFile: 'model-automatise-recettes-petroliere-op-beac.sql',
                periode: PeriodeParDefaut::MOIS,
                refManuel: 'SROT p. 26',
                sourceLot: 'ig-petrole',
            ),
            new ExtractionDefinition(
                code: 'ig-rusid',
                libelle: 'RUSID (4663-218)',
                source: SourceExtraction::IG,
                famille: 'ig-recaps',
                domaine: DomaineExtraction::RECETTES,
                ecran: 'MCPT',
                format: 'F8',
                sqlFile: 'model-automatise-recettes-douanieres.sql',
                periode: PeriodeParDefaut::MOIS,
                refManuel: 'SROT p. 25',
                comptes: ['4663-218'],
                sourceLot: 'ig-douanes',
            ),
            new ExtractionDefinition(
                code: 'ig-rcdd',
                libelle: 'Déversements solde et pension',
                source: SourceExtraction::IG,
                famille: 'ig-recaps',
                domaine: DomaineExtraction::DEPENSES,
                ecran: 'RCDD',
                format: 'F9',
                sqlFile: 'depenses-etats-liquidation.sql',
                periode: PeriodeParDefaut::MOIS,
                refManuel: 'SROT p. 6-7',
                disponible: false,
                motifIndisponible: 'dépôt Excel uniquement',
                depotExcelUniquement: true,
                sourceLot: 'ig-deversements',
            ),

            // —— DC · Règlements ——
            new ExtractionDefinition(
                code: 'dc-xrgv',
                libelle: 'Règlements sur ordonnances (mode BOP)',
                source: SourceExtraction::DC,
                famille: 'dc-reglements',
                domaine: DomaineExtraction::DEPENSES,
                ecran: 'XRGV',
                format: 'F2',
                sqlFile: 'depenses-reglements-ordonnances-xrgv.sql',
                periode: PeriodeParDefaut::EXERCICE_A_DATE,
                refManuel: 'SROT p. 8-9',
                sourceLot: 'dc-regl',
            ),
            new ExtractionDefinition(
                code: 'dc-xrgm-tva',
                libelle: 'Règlements des mandats TVA (4781-31, nature 81)',
                source: SourceExtraction::DC,
                famille: 'dc-reglements',
                domaine: DomaineExtraction::RECETTES,
                ecran: 'XRGM',
                format: 'F4',
                sqlFile: 'depenses-remboursements-tva-exercice.sql',
                periode: PeriodeParDefaut::EXERCICE_A_DATE,
                refManuel: 'SROT p. 10-11',
                sourceLot: 'dc-tva',
            ),

            // —— DC · RAP ——
            new ExtractionDefinition(
                code: 'dc-xrav',
                libelle: 'RAP sur ordonnances (mode BOP)',
                source: SourceExtraction::DC,
                famille: 'dc-rap',
                domaine: DomaineExtraction::EXECUTION,
                ecran: 'XRAV',
                format: 'F14',
                sqlFile: 'dc-rap-mode-bop-xrav.sql',
                periode: PeriodeParDefaut::DEPUIS_2014,
                disponible: false,
                motifIndisponible: 'requête non disponible',
                sourceLot: 'dc-rap-bop',
            ),
            new ExtractionDefinition(
                code: 'dc-xram-tva',
                libelle: 'RAP sur mandats TVA (4781-31, nature 81)',
                source: SourceExtraction::DC,
                famille: 'dc-rap',
                domaine: DomaineExtraction::RECETTES,
                ecran: 'XRAM',
                format: 'F5',
                sqlFile: 'depenses-reste-a-payer-4781-31.sql',
                periode: PeriodeParDefaut::EXERCICE_A_DATE,
                refManuel: 'SROT p. 9-10',
                sourceLot: 'dc-rap-tva',
            ),
            new ExtractionDefinition(
                code: 'dc-rap-avant-bop',
                libelle: 'RAP avant BOP',
                source: SourceExtraction::DC,
                famille: 'dc-rap',
                domaine: DomaineExtraction::EXECUTION,
                ecran: '—',
                format: 'F14',
                sqlFile: null,
                periode: PeriodeParDefaut::AUCUNE,
                disponible: false,
                depotExcelUniquement: true,
                motifIndisponible: 'dépôt Excel uniquement',
                sourceLot: 'dc-rap-avant-bop',
            ),

            // —— DC · Ordonnances ——
            new ExtractionDefinition(
                code: 'dc-xlop',
                libelle: 'Ordonnances visées',
                source: SourceExtraction::DC,
                famille: 'dc-ordonnances',
                domaine: DomaineExtraction::EXECUTION,
                ecran: 'XLOP',
                format: 'F3',
                sqlFile: 'dc-ordonnances-visees-xlop.sql',
                periode: PeriodeParDefaut::EXERCICE_A_DATE,
                disponible: false,
                motifIndisponible: 'requête non disponible',
                sourceLot: 'dc-ordos',
            ),
            new ExtractionDefinition(
                code: 'dc-cdel',
                libelle: 'Situation des crédits délégués',
                source: SourceExtraction::DC,
                famille: 'dc-ordonnances',
                domaine: DomaineExtraction::EXECUTION,
                ecran: 'CDEL',
                format: 'F6',
                sqlFile: 'dc-situation-credits-delegues-cdel.sql',
                periode: PeriodeParDefaut::EXERCICE_A_DATE,
                disponible: false,
                motifIndisponible: 'requête non disponible',
                sourceLot: 'dc-cdel',
            ),
        ];
    }
}
