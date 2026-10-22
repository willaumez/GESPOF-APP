<?php

declare(strict_types=1);

namespace App\Tests\Module\ServiceOperationsFinancieres\Entite;

use App\Module\ServiceOperationsFinancieres\Entite\Recette\RubriqueRecette;
use App\Module\ServiceOperationsFinancieres\Enum\SectionRecette;
use PHPUnit\Framework\TestCase;

final class RubriqueRecetteTest extends TestCase
{
    public function testNiveauRacineEtEnfant(): void
    {
        $racine = new RubriqueRecette('PET', 'Recettes pétrolières', SectionRecette::PETROLE, null, true);
        $enfant = new RubriqueRecette('103', 'Profit oil', SectionRecette::PETROLE, $racine);

        self::assertTrue($racine->estRacine());
        self::assertSame(1, $racine->getNiveau());
        self::assertFalse($enfant->estRacine());
        self::assertSame(2, $enfant->getNiveau());
        self::assertSame($racine, $enfant->getParent());
        self::assertTrue($racine->getEnfants()->contains($enfant));
    }

    public function testPetitFilsCalculeLeNiveauTrois(): void
    {
        $racine = new RubriqueRecette('FIS', 'Recettes fiscales', SectionRecette::RECETTES_FISCALES, null, true);
        $tva = new RubriqueRecette('TVA', 'TVA', SectionRecette::RECETTES_FISCALES, $racine, true);
        $groupe = new RubriqueRecette('TVA_GRP', 'TVA Groupe', SectionRecette::RECETTES_FISCALES, $tva);

        self::assertSame(3, $groupe->getNiveau());
    }
}
