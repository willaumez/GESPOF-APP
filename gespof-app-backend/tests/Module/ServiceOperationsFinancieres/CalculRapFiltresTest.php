<?php

declare(strict_types=1);

namespace App\Tests\Module\ServiceOperationsFinancieres;

use App\Module\ServiceOperationsFinancieres\Support\CalculRapFiltres;
use App\Module\ServiceOperationsFinancieres\Support\ClassementCreditDelegue;
use PHPUnit\Framework\TestCase;

final class CalculRapFiltresTest extends TestCase
{
    public function testCreditDelegueRapPositif(): void
    {
        self::assertTrue(CalculRapFiltres::creditDelegueRapPositif('1.00'));
        self::assertFalse(CalculRapFiltres::creditDelegueRapPositif('0.00'));
        self::assertFalse(CalculRapFiltres::creditDelegueRapPositif('-10.00'));
    }

    public function testCategorieAutorisee(): void
    {
        self::assertTrue(CalculRapFiltres::categorieAutorisee('ENT'));
        self::assertTrue(CalculRapFiltres::categorieAutorisee('tpg'));
        self::assertFalse(CalculRapFiltres::categorieAutorisee('XYZ'));
        self::assertFalse(CalculRapFiltres::categorieAutorisee(null));
    }

    public function testAvantBopSeuleEnt(): void
    {
        self::assertTrue(CalculRapFiltres::categorieSelonContexte('ENT', true, 2024));
        self::assertFalse(CalculRapFiltres::categorieSelonContexte('TPG', true, 2024));
    }

    public function testModeBopExercice2015SeuleEnt(): void
    {
        self::assertTrue(CalculRapFiltres::categorieSelonContexte('ENT', false, 2015));
        self::assertFalse(CalculRapFiltres::categorieSelonContexte('AGC', false, 2015));
        self::assertTrue(CalculRapFiltres::categorieSelonContexte('AGC', false, 2024));
    }

    public function testNatureCotisationsAvantBop(): void
    {
        self::assertTrue(CalculRapFiltres::natureExclueAvantBop(
            CalculRapFiltres::NATURE_EXCLUE_AVANT_BOP,
            true,
        ));
        self::assertFalse(CalculRapFiltres::natureExclueAvantBop(
            CalculRapFiltres::NATURE_EXCLUE_AVANT_BOP,
            false,
        ));
    }

    public function testMdrExcluModeBop(): void
    {
        self::assertTrue(CalculRapFiltres::mdrExclu('710', CalculRapFiltres::MDR_EXCLUS_DEFAUT, true));
        self::assertFalse(CalculRapFiltres::mdrExclu('710', CalculRapFiltres::MDR_EXCLUS_DEFAUT, false));
        self::assertFalse(CalculRapFiltres::mdrExclu('100', CalculRapFiltres::MDR_EXCLUS_DEFAUT, true));
    }

    public function testFiltrerLignePipeline(): void
    {
        $ok = CalculRapFiltres::filtrerLigne(
            ['nature' => 'PERSONNEL', 'c_categ' => 'ENT', 'mdr' => '100', 'ordonnance' => 'X', 'exercice' => 2024],
            false,
            true,
            CalculRapFiltres::MDR_EXCLUS_DEFAUT,
            ['HORS'],
        );
        self::assertTrue($ok['retenue']);

        $ko = CalculRapFiltres::filtrerLigne(
            ['rap' => '-1.00'],
            false,
            true,
            [],
            [],
            true,
        );
        self::assertFalse($ko['retenue']);
        self::assertSame('RAP_NEGATIF_OU_NUL', $ko['motif']);
    }

    public function testDelaiArriereEgaliteIncluse(): void
    {
        $echeance = new \DateTimeImmutable('2025-09-01');
        $valeur = new \DateTimeImmutable('2025-11-30');
        self::assertTrue(ClassementCreditDelegue::estArriereRap($echeance, $valeur, 90));
        self::assertFalse(ClassementCreditDelegue::estArriereRap(
            new \DateTimeImmutable('2025-09-02'),
            $valeur,
            90,
        ));
    }
}
