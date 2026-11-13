<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\DataFixtures;

use App\Module\ServiceOperationsFinancieres\Entite\Exercice;
use App\Module\ServiceOperationsFinancieres\Enum\LoiEnVigueur;
use App\Module\ServiceOperationsFinancieres\Enum\StatutExercice;
use Doctrine\Persistence\ObjectManager;

/**
 * Exercice de référence pour les tests / chargement initial.
 */
final class ExerciceFixtures
{
    public const ANNEE_REFERENCE = 2026;

    public function charger(ObjectManager $manager): void
    {
        if ($manager->find(Exercice::class, self::ANNEE_REFERENCE) instanceof Exercice) {
            return;
        }

        $manager->persist(new Exercice(
            self::ANNEE_REFERENCE,
            '812437500000.00',
            LoiEnVigueur::LFR,
            26,
            90,
            StatutExercice::OUVERT,
            new \DateTimeImmutable('2026-01-02'),
        ));
    }
}
