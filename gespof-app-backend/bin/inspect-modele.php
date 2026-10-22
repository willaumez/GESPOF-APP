<?php

require dirname(__DIR__).'/vendor/autoload.php';

use PhpOffice\PhpSpreadsheet\IOFactory;

$modele = dirname(__DIR__).'/src/Shared/ModelFichier/FICHE_DE_DEPOT_MODELE_CORRIGE.xlsx';
$t0 = microtime(true);
$wb = IOFactory::load($modele);
echo 'load_ms=' . (int) ((microtime(true) - $t0) * 1000) . PHP_EOL;

foreach ($wb->getAllSheets() as $s) {
    echo $s->getTitle()
        .' rows='.$s->getHighestRow()
        .' cols='.$s->getHighestColumn()
        .' merges='.count($s->getMergeCells())
        .PHP_EOL;
}
