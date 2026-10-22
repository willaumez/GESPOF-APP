<?php

$path = $argv[1] ?? '';
if ($path === '' || !is_file($path)) {
    fwrite(STDERR, "Usage: php inspect-xlsx.php <file.xlsx>\n");
    exit(1);
}

$z = new ZipArchive();
if ($z->open($path) !== true) {
    fwrite(STDERR, "Cannot open $path\n");
    exit(1);
}

echo "file=$path\n";
echo "size=" . filesize($path) . "\n";
echo "entries=" . $z->numFiles . "\n";

for ($i = 0; $i < $z->numFiles; $i++) {
    $n = $z->getNameIndex($i);
    if (
        str_contains($n, 'styles')
        || str_contains($n, 'sheet')
        || str_contains($n, 'theme')
        || str_contains($n, 'workbook')
        || str_contains($n, 'shared')
    ) {
        echo $n . ' size=' . $z->statIndex($i)['size'] . "\n";
    }
}

$sheet1 = $z->getFromName('xl/worksheets/sheet1.xml') ?: '';
echo "merges=" . substr_count($sheet1, 'mergeCell') . "\n";
echo "sheet1_len=" . strlen($sheet1) . "\n";
echo "cols=" . (str_contains($sheet1, '<cols>') ? 'yes' : 'no') . "\n";

$styles = $z->getFromName('xl/styles.xml') ?: '';
echo "styles_len=" . strlen($styles) . "\n";
echo "patternFill=" . (str_contains($styles, 'patternFill') ? 'yes' : 'no') . "\n";
echo "rgb_fills=" . preg_match_all('/rgb="([A-Fa-f0-9]{6,8})"/', $styles) . "\n";

$wb = $z->getFromName('xl/workbook.xml') ?: '';
preg_match_all('/name="([^"]+)"/', $wb, $m);
echo "sheets=" . implode(' | ', $m[1] ?? []) . "\n";

$z->close();
