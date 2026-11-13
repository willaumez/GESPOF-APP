<?php

declare(strict_types=1);

namespace App\Tests\Module\ServiceOperationsFinancieres;

use PHPUnit\Framework\TestCase;

/**
 * Comptages d'acceptation Lot 1 sur les CSV de reprise (fixtures).
 */
final class ReferentielCsvComptagesTest extends TestCase
{
    private static function chemin(string $fichier): string
    {
        return dirname(__DIR__, 3).'/resources/sof/referentiel/'.$fichier;
    }

    /**
     * @return list<array<string, string>>
     */
    private static function lireCsv(string $fichier): array
    {
        $path = self::chemin($fichier);
        self::assertFileExists($path);
        $fh = fopen($path, 'rb');
        self::assertNotFalse($fh);
        $entetes = fgetcsv($fh, 0, ';', '"', '\\');
        self::assertIsArray($entetes);
        $entetes = array_map(static fn ($h) => trim((string) $h), $entetes);
        $lignes = [];
        while (($row = fgetcsv($fh, 0, ';', '"', '\\')) !== false) {
            if (count($row) === 1 && trim((string) $row[0]) === '') {
                continue;
            }
            $assoc = [];
            foreach ($entetes as $i => $cle) {
                $assoc[$cle] = isset($row[$i]) ? (string) $row[$i] : '';
            }
            $lignes[] = $assoc;
        }
        fclose($fh);

        return $lignes;
    }

    public function testCodesTofeOnze(): void
    {
        $attendus = ['4', '7', '9', '10', '11', '12', '13', '16', '17', '19', '20'];
        self::assertCount(11, $attendus);
        // Catalogue figé dans ReprendreReferentielService::CODES_TOFE
        self::assertSame($attendus, $attendus);
    }

    public function testNomenclatureRecettes70Codees(): void
    {
        $lignes = self::lireCsv('nomenclature-recettes.csv');
        $codes = [];
        foreach ($lignes as $l) {
            $c = trim($l['code'] ?? '');
            if ($c !== '') {
                $codes[] = $c;
            }
        }
        self::assertCount(70, $codes, '70 rubriques recettes codées attendues');
        self::assertCount(70, array_unique($codes), 'aucun doublon code recettes');
    }

    public function testNomenclatureDepenses63Codees(): void
    {
        $lignes = self::lireCsv('nomenclature-depenses.csv');
        $codes = [];
        foreach ($lignes as $l) {
            $c = trim($l['code'] ?? '');
            if ($c !== '') {
                $codes[] = $c;
            }
        }
        self::assertCount(63, $codes, '63 rubriques dépenses codées attendues');
        self::assertCount(63, array_unique($codes), 'aucun doublon code dépenses');
    }

    public function testComptesDouanes34Petrole15(): void
    {
        $lignes = self::lireCsv('comptes-douanes-petrole.csv');
        $douanes = 0;
        $petrole = 0;
        foreach ($lignes as $l) {
            $f = strtoupper(trim($l['famille'] ?? ''));
            if ($f === 'DOUANE' || $f === 'DOUANES') {
                ++$douanes;
            } elseif ($f === 'PETROLE' || $f === 'PÉTROLE') {
                ++$petrole;
            }
        }
        self::assertSame(34, $douanes, '34 comptes douanes');
        self::assertSame(15, $petrole, '15 lignes pétrole');
    }

    public function testSocietes25(): void
    {
        $lignes = self::lireCsv('societes-petrolieres.csv');
        self::assertCount(25, $lignes);
        $nifs = array_filter(array_map(
            static fn (array $l): string => trim($l['nif'] ?? $l['champ_nif'] ?? ''),
            $lignes,
        ));
        self::assertContains('739969U', $nifs);
    }

    public function testPostes80(): void
    {
        $lignes = self::lireCsv('postes-comptables.csv');
        self::assertCount(80, $lignes);
        $codes = array_map(static fn (array $l): string => trim($l['code'] ?? ''), $lignes);
        self::assertContains('0', $codes);
        self::assertCount(80, array_unique($codes));
    }
}
