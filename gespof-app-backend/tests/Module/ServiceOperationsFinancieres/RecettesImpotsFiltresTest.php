<?php

declare(strict_types=1);

namespace App\Tests\Module\ServiceOperationsFinancieres;

use App\Module\ServiceOperationsFinancieres\Support\RecettesImpotsFiltres;
use PHPUnit\Framework\TestCase;

final class RecettesImpotsFiltresTest extends TestCase
{
    public function testPrefixeEtRetenue(): void
    {
        self::assertTrue(RecettesImpotsFiltres::estCompteRetenu('1812-201'));
        self::assertTrue(RecettesImpotsFiltres::estCompteRetenu('4781-31'));
        self::assertTrue(RecettesImpotsFiltres::estCompteRetenu('4783-10'));
        self::assertFalse(RecettesImpotsFiltres::estCompteRetenu('4701-525'));
    }

    public function testPecSansNatureEcartee(): void
    {
        self::assertFalse(RecettesImpotsFiltres::operationRetenue('4781-31', 'N', null));
        self::assertFalse(RecettesImpotsFiltres::operationRetenue('4781-31', 'N', ''));
        self::assertTrue(RecettesImpotsFiltres::operationRetenue('4781-31', 'N', '81'));
    }

    public function testNopEtPrecompte(): void
    {
        self::assertTrue(RecettesImpotsFiltres::operationRetenue('1812-100', 'B', null));
        self::assertTrue(RecettesImpotsFiltres::operationRetenue('1812-100', 'N', null));
        self::assertFalse(RecettesImpotsFiltres::operationRetenue('1812-100', 'R', null));
        self::assertTrue(RecettesImpotsFiltres::operationRetenue('1812-211', 'X', null));
        self::assertSame('RF5', RecettesImpotsFiltres::codeRfParticulier('1812-211', false));
    }

    public function testRfPetrole(): void
    {
        self::assertSame('RF36', RecettesImpotsFiltres::codeRfParticulier('1812-100', true, 'IS'));
        self::assertSame('RF76', RecettesImpotsFiltres::codeRfParticulier('1812-100', true, 'DIVIDENDES'));
        self::assertSame('RF80', RecettesImpotsFiltres::codeRfParticulier('1812-100', true, 'RMP'));
    }
}
