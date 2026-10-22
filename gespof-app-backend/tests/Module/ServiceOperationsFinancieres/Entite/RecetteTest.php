<?php

declare(strict_types=1);

namespace App\Tests\Module\ServiceOperationsFinancieres\Entite;

use App\Module\ServiceOperationsFinancieres\Entite\Exercice;
use App\Module\ServiceOperationsFinancieres\Entite\Recette\Recette;
use App\Module\ServiceOperationsFinancieres\Entite\Recette\RubriqueRecette;
use App\Module\ServiceOperationsFinancieres\Enum\SectionRecette;
use PHPUnit\Framework\TestCase;

final class RecetteTest extends TestCase
{
    public function testRecalculerMontantTotalAdditionneEnBcmath(): void
    {
        $recette = $this->nouvelleRecette();

        $recette->setMontantAutomatise('1234.56');
        $recette->setMontantAjustement('78.90');
        self::assertSame('0.00', $recette->getMontantTotal());

        $recette->recalculerMontantTotal();
        self::assertSame('1313.46', $recette->getMontantTotal());
    }

    public function testMoisHorsPlageEstRejete(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        $this->nouvelleRecette(13);
    }

    private function nouvelleRecette(int $mois = 1): Recette
    {
        $exercice = new Exercice(2025, '0.00');
        $rubrique = new RubriqueRecette('103', 'Profit oil', SectionRecette::PETROLE);

        return new Recette($exercice, $rubrique, $mois);
    }
}
