<?php

declare(strict_types=1);

namespace App\Tests\Module\ServiceOperationsFinancieres;

use App\Module\ServiceOperationsFinancieres\Support\Flechage\Abcd;
use App\Module\ServiceOperationsFinancieres\Support\Flechage\AvancesBudget;
use App\Module\ServiceOperationsFinancieres\Support\Flechage\CorrespondantsD;
use App\Module\ServiceOperationsFinancieres\Support\Flechage\CorrespondantsR;
use App\Module\ServiceOperationsFinancieres\Support\Flechage\CreditsDelegues;
use App\Module\ServiceOperationsFinancieres\Support\Flechage\DepensesManuelles;
use App\Module\ServiceOperationsFinancieres\Support\Flechage\Reglements;
use App\Module\ServiceOperationsFinancieres\Support\Flechage\TitreAb;
use App\Module\ServiceOperationsFinancieres\Support\Flechage\TitreAvances;
use PHPUnit\Framework\TestCase;

final class FlechageDeterministeTest extends TestCase
{
    public function testReglementsAntTitre1(): void
    {
        $r = Reglements::code('REG', 'ANT', 1, 661000);
        self::assertSame('C', $r['code']);
    }

    public function testReglementsCourantTitre3Y(): void
    {
        $r = Reglements::code('REG', 'EX', 3, 611000);
        self::assertSame('Y', $r['code']);
    }

    public function testReglementsMdrGe700Vide(): void
    {
        $r = Reglements::code('REG', 'EX', 1, 100000, 710);
        self::assertSame('', $r['code']);
        self::assertSame('MDR_GE_700', $r['motif']);
    }

    public function testReglementsCategAgcVide(): void
    {
        $r = Reglements::code('AGC', 'EX', 1, 100000);
        self::assertSame('', $r['code']);
    }

    public function testReglementsBogueVCompat(): void
    {
        // NAT 605100 → nat4=6051 ; en compat, titre 3 → Z (pas V).
        $compat = Reglements::code('REG', 'EX', 3, 605100, 0, true);
        self::assertSame('Z', $compat['code']);
        $corrige = Reglements::code('REG', 'EX', 3, 605100, 0, false);
        self::assertSame('V', $corrige['code']);
    }

    public function testAbcdAvanceCourante(): void
    {
        self::assertSame('V', Abcd::code('4701-525', 'N', 53, 25));
        self::assertSame('Z', Abcd::code('4701-525', 'N', 619101, 25)); // bogue B2
    }

    public function testTitreAb(): void
    {
        self::assertSame(1, TitreAb::titre(670000));
        self::assertSame(0, TitreAb::titre(50, false));
        self::assertSame(3, TitreAb::titre(610000));
    }

    public function testTitreAvances(): void
    {
        self::assertSame(0, TitreAvances::titre(51, 0, 0));
        self::assertSame(3, TitreAvances::titre(51, 1, 0));
        self::assertSame(5, TitreAvances::titre(71, 2, 0));
    }

    public function testAvancesBudgetPipeline(): void
    {
        $r = AvancesBudget::classer('4701-525', 'N', 53, 2025);
        self::assertSame('V', $r['code']);
        self::assertSame('EX', $r['exercice']);
    }

    public function testCreditsDeleguesCourantArriere(): void
    {
        $c = CreditsDelegues::classer('2501234567', '611000', 'N', 25);
        self::assertSame('AI', $c['code']);
        $a = CreditsDelegues::classer('2401234567', '611000', 'B', 25);
        self::assertSame('D1', $a['code']);
        $r = CreditsDelegues::classer('2501234567', '611000', 'R', 25);
        self::assertSame('', $r['code']);
        self::assertSame('C_NOP_R', $r['motif']);
    }

    public function testCorrespondantsD(): void
    {
        self::assertSame('AJ', CorrespondantsD::code('Agences Comptables'));
        self::assertSame('AL', CorrespondantsD::code('Assurance Maladie CNAMGS'));
        self::assertSame('AS', CorrespondantsD::code('Fonds Communs', '4663-278'));
        self::assertSame('AT', CorrespondantsD::code('Fonds Communs', '4663-275'));
        self::assertSame('NONE', CorrespondantsD::code('Inconnue XYZ'));
    }

    public function testCorrespondantsR(): void
    {
        self::assertSame('AZ', CorrespondantsR::code('ANGT'));
        self::assertSame('AAA', CorrespondantsR::code('Correspondants : CNSS'));
        self::assertSame('AAG', CorrespondantsR::code('Collectivités Locales'));
        self::assertSame('NONE', CorrespondantsR::code('Fonds divers'));
    }

    public function testDepensesManuelles(): void
    {
        self::assertSame('Q', DepensesManuelles::code('Intérêts dette intérieure'));
        self::assertSame('AF', DepensesManuelles::code('Pensions'));
        self::assertSame('AAE1', DepensesManuelles::code('BTA tirages'));
        self::assertSame('N', DepensesManuelles::code('Solde permanente'));
    }
}
