<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Extraction;

enum SourceExtraction: string
{
    case IG = 'IG';
    case DC = 'DC';
}
