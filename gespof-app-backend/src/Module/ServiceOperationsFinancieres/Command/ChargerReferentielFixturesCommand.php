<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Command;

use App\Module\ServiceOperationsFinancieres\DataFixtures\CompteDouaneFixtures;
use App\Module\ServiceOperationsFinancieres\DataFixtures\ExerciceFixtures;
use App\Module\ServiceOperationsFinancieres\DataFixtures\RubriqueDepenseFixtures;
use App\Module\ServiceOperationsFinancieres\DataFixtures\RubriqueRecetteFixtures;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;

/**
 * Charge le référentiel budgétaire SOF (DoctrineFixturesBundle n'est pas
 * installé : ce chargeur module le remplace).
 */
#[AsCommand(
    name: 'sof:referentiel:charger',
    description: 'Charge les fixtures du référentiel budgétaire SOF (rubriques + exercice 2025).',
)]
final class ChargerReferentielFixturesCommand extends Command
{
    public function __construct(
        private readonly EntityManagerInterface $entityManager,
        private readonly RubriqueRecetteFixtures $rubriqueRecetteFixtures,
        private readonly RubriqueDepenseFixtures $rubriqueDepenseFixtures,
        private readonly CompteDouaneFixtures $compteDouaneFixtures,
        private readonly ExerciceFixtures $exerciceFixtures,
    ) {
        parent::__construct();
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);

        $this->rubriqueRecetteFixtures->charger($this->entityManager);
        $this->rubriqueDepenseFixtures->charger($this->entityManager);
        $this->compteDouaneFixtures->charger($this->entityManager);
        $this->exerciceFixtures->charger($this->entityManager);
        $this->entityManager->flush();

        $io->success('Référentiel SOF chargé (rubriques, comptes douaniers, exercice 2025).');

        return Command::SUCCESS;
    }
}
