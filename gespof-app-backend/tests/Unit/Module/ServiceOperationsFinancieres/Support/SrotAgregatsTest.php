<?php

declare(strict_types=1);

namespace App\Tests\Unit\Module\ServiceOperationsFinancieres\Support;

use App\Module\ServiceOperationsFinancieres\Support\SrotAgregats;
use PHPUnit\Framework\TestCase;

final class SrotAgregatsTest extends TestCase
{
    public function testSommeMoisEtCumul(): void
    {
        $index = [
            'N' => [1 => '100.00', 2 => '50.00', 3 => '25.00'],
            'O' => [1 => '10.00', 2 => '20.00'],
        ];

        self::assertSame(
            '70.00',
            SrotAgregats::somme($index, ['N', 'O'], 2, false),
        );
        self::assertSame(
            '180.00',
            SrotAgregats::somme($index, ['N', 'O'], 2, true),
        );
    }

    public function testEnMillions(): void
    {
        self::assertSame('1.500000', SrotAgregats::enMillions('1500000.00'));
    }
}
