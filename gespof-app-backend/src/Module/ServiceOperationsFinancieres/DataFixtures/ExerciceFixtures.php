<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\DataFixtures;

use App\Module\ServiceOperationsFinancieres\Entite\Exercice;
use Doctrine\Persistence\ObjectManager;

/**
 * Exercice de référence pour les tests d'intégration.
 */
final class ExerciceFixtures
{
    public const ANNEE_REFERENCE = 2025;

    public function charger(ObjectManager $manager): void
    {
        if ($manager->find(Exercice::class, self::ANNEE_REFERENCE) instanceof Exercice) {
            return;
        }

        $manager->persist(new Exercice(self::ANNEE_REFERENCE, '0.00'));
    }
}
