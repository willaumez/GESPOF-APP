<?php

declare(strict_types=1);

require dirname(__DIR__).'/vendor/autoload.php';

use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;

$modele = dirname(__DIR__).'/src/Shared/ModelFichier/FICHE_DE_DEPOT_MODELE_CORRIGE.xlsx';
echo 'model: '.(is_file($modele) ? 'OK' : 'MISSING').PHP_EOL;

$t0 = microtime(true);
$wb = IOFactory::load($modele);
echo 'load_ms='.(int) ((microtime(true) - $t0) * 1000).PHP_EOL;

$s = $wb->getSheetByName('Reglements du jour');
echo 'A1='.$s->getCell('A1')->getValue().PHP_EOL;

foreach (array_reverse($s->getMergeCells()) as $plage) {
    if ((int) preg_replace('/^[^0-9]+/', '', explode(':', $plage)[0]) >= 8) {
        $s->unmergeCells($plage);
    }
}
$derniere = max(8, (int) $s->getHighestRow());
$s->removeRow(8, $derniere - 8 + 1);

$s->mergeCells('A8:J8');
$s->setCellValue('A8', 'OPERATIONS EN NUMERAIRE');
$s->getStyle('A8:J8')->applyFromArray([
    'font' => ['bold' => true],
    'fill' => [
        'fillType' => Fill::FILL_SOLID,
        'startColor' => ['rgb' => 'E2D4F0'],
    ],
    'borders' => [
        'allBorders' => ['borderStyle' => Border::BORDER_THIN],
    ],
]);

$s->mergeCells('A9:G9');
$s->setCellValue('A9', 'TOTAL NUMERAIRE');
$s->setCellValue('H9', 123456);
$s->mergeCells('I9:J9');
$s->getStyle('A9:G9')->applyFromArray([
    'font' => ['bold' => true],
    'fill' => [
        'fillType' => Fill::FILL_SOLID,
        'startColor' => ['rgb' => 'D5C6EC'],
    ],
]);
$s->getStyle('H9:J9')->applyFromArray([
    'font' => ['bold' => true],
    'fill' => [
        'fillType' => Fill::FILL_SOLID,
        'startColor' => ['rgb' => 'F8CBAD'],
    ],
]);

$out = dirname(__DIR__).'/var/test_fiche_couleur.xlsx';
$t1 = microtime(true);
(new Xlsx($wb))->save($out);
echo 'save_ms='.(int) ((microtime(true) - $t1) * 1000).PHP_EOL;
echo 'saved: '.$out.' size='.filesize($out).PHP_EOL;

$z = new ZipArchive();
$z->open($out);
$styles = $z->getFromName('xl/styles.xml') ?: '';
$sheet1 = $z->getFromName('xl/worksheets/sheet1.xml') ?: '';
echo 'merges='.substr_count($sheet1, 'mergeCell').PHP_EOL;
echo 'rgb_fills='.preg_match_all('/rgb="([A-Fa-f0-9]{6,8})"/', $styles).PHP_EOL;
$z->close();
