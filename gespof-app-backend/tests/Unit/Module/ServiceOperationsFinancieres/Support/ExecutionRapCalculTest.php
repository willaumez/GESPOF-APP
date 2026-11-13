<?php

declare(strict_types=1);

namespace App\Tests\Unit\Module\ServiceOperationsFinancieres\Support;

use App\Module\ServiceOperationsFinancieres\Support\ExecutionRapCalcul;
use PHPUnit\Framework\TestCase;

final class ExecutionRapCalculTest extends TestCase
{
    public function testTypeTitre(): void
    {
        self::assertSame('INV', ExecutionRapCalcul::typeTitre('5'));
        self::assertSame('FCT', ExecutionRapCalcul::typeTitre('2'));
    }

    public function testExerciceCrnAnt(): void
    {
        self::assertSame('CRN', ExecutionRapCalcul::exerciceCrnAnt(2026, 2026));
        self::assertSame('ANT', ExecutionRapCalcul::exerciceCrnAnt(2024, 2026));
    }

    public function testGrandeNatureEtInvest(): void
    {
        self::assertSame(66, ExecutionRapCalcul::grandeNature('661801'));
        self::assertTrue(ExecutionRapCalcul::estInvestissement('200001'));
        self::assertFalse(ExecutionRapCalcul::estInvestissement('661801'));
    }

    public function testDecouperRapArriere(): void
    {
        $echeance = new \DateTimeImmutable('2025-01-01');
        $valeur = new \DateTimeImmutable('2025-06-01');
        $d = ExecutionRapCalcul::decouperRap('1000.00', $echeance, $valeur, 90);
        self::assertSame('ARRIERE', $d['statut']);
        self::assertSame('1000.00', $d['arrieres']);
        self::assertSame('0.00', $d['instances']);
    }
}
