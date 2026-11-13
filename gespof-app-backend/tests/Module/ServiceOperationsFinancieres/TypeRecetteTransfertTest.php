<?php

declare(strict_types=1);

namespace App\Tests\Module\ServiceOperationsFinancieres;

use App\Module\ServiceOperationsFinancieres\Enum\TypeRecetteTransfert;
use PHPUnit\Framework\TestCase;

final class TypeRecetteTransfertTest extends TestCase
{
    public function testCodesSrotSpec51(): void
    {
        self::assertSame('103', TypeRecetteTransfert::IS->rubriqueCode());
        self::assertSame('211', TypeRecetteTransfert::DIVIDENDES->rubriqueCode());
        self::assertSame('261', TypeRecetteTransfert::RMP->rubriqueCode());
        self::assertSame('263', TypeRecetteTransfert::REDEVANCE_SUP->rubriqueCode());
        self::assertSame('262', TypeRecetteTransfert::PROFIT_OIL->rubriqueCode());
        self::assertSame('264', TypeRecetteTransfert::DISCOUNT_BONI->rubriqueCode());
        self::assertSame('266', TypeRecetteTransfert::PIPES->rubriqueCode());
        self::assertNull(TypeRecetteTransfert::NA->rubriqueCode());
    }
}
