<?php

declare(strict_types=1);

namespace App\Tests\Module\ServiceOperationsFinancieres;

use App\Module\ServiceOperationsFinancieres\Support\ClassementCreditDelegue;
use PHPUnit\Framework\TestCase;

final class ClassementCreditDelegueTest extends TestCase
{
    public function testPrefixeCourantDixChiffres(): void
    {
        // floor(2501234567 / 1e8) = 25
        $r = ClassementCreditDelegue::classer('2501234567', 25);
        self::assertSame(ClassementCreditDelegue::TYPE_COURANT, $r['type_exercice']);
        self::assertNull($r['anomalie']);
        self::assertSame(25, $r['prefixe_extrait']);
    }

    public function testArriereAutrePrefixe(): void
    {
        $r = ClassementCreditDelegue::classer('2401234567', 25);
        self::assertSame(ClassementCreditDelegue::TYPE_ARRIERE, $r['type_exercice']);
        self::assertNull($r['anomalie']);
    }

    public function testFormatAnormalNeufChiffres(): void
    {
        $r = ClassementCreditDelegue::classer('250123456', 25);
        self::assertSame(ClassementCreditDelegue::TYPE_ARRIERE, $r['type_exercice']);
        self::assertSame(ClassementCreditDelegue::ANOMALIE_FORMAT, $r['anomalie']);
    }

    public function testDelaiArriereEgaliteIncluse(): void
    {
        $echeance = new \DateTimeImmutable('2025-09-01');
        $valeur = new \DateTimeImmutable('2025-11-30');
        self::assertTrue(ClassementCreditDelegue::estArriereRap($echeance, $valeur, 90));

        $instance = new \DateTimeImmutable('2025-09-02');
        self::assertFalse(ClassementCreditDelegue::estArriereRap($instance, $valeur, 90));
    }
}
