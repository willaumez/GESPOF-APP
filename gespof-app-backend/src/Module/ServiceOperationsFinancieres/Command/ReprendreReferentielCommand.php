<?php

declare(strict_types=1);

namespace App\Module\ServiceOperationsFinancieres\Command;

use App\Module\ServiceOperationsFinancieres\Service\ReprendreReferentielService;
use App\Shared\Exception\DonneesInvalidesException;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputArgument;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;

#[AsCommand(
    name: 'sof:referentiel:reprendre',
    description: 'Reprend un référentiel SOF depuis un CSV (idempotent).',
)]
final class ReprendreReferentielCommand extends Command
{
    public function __construct(
        private readonly ReprendreReferentielService $reprendreReferentielService,
    ) {
        parent::__construct();
    }

    protected function configure(): void
    {
        $this
            ->addArgument('nom', InputArgument::REQUIRED, 'codes-tofe|nomenclature-recettes|nomenclature-depenses|comptes|societes-petrolieres|postes-comptables')
            ->addArgument('fichier', InputArgument::OPTIONAL, 'Chemin CSV (défaut : resources/sof/referentiel/<nom>.csv)')
            ->addOption('dry-run', null, InputOption::VALUE_NONE, 'Affiche créés / modifiés / ignorés sans écrire');
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);
        $nom = (string) $input->getArgument('nom');
        $fichier = (string) ($input->getArgument('fichier') ?: $this->fichierParDefaut($nom));
        $dry = (bool) $input->getOption('dry-run');

        try {
            $rapport = $this->reprendreReferentielService->reprendre($nom, $fichier, $dry);
        } catch (DonneesInvalidesException $e) {
            $io->error($e->getMessage());

            return Command::FAILURE;
        }

        $io->title(($dry ? '[dry-run] ' : '').'Reprise « '.$nom.' »');
        $io->writeln(sprintf(
            'Créés : %d · Modifiés : %d · Ignorés : %d',
            $rapport['crees'],
            $rapport['modifies'],
            $rapport['ignores'],
        ));
        foreach (array_slice($rapport['details'], 0, 40) as $ligne) {
            $io->writeln('  · '.$ligne);
        }
        if (count($rapport['details']) > 40) {
            $io->writeln(sprintf('  … +%d lignes', count($rapport['details']) - 40));
        }
        foreach ($rapport['warnings'] as $w) {
            $io->warning($w);
        }
        $io->success($dry ? 'Simulation terminée.' : 'Reprise enregistrée.');

        return Command::SUCCESS;
    }

    private function fichierParDefaut(string $nom): string
    {
        $map = [
            'codes-tofe' => 'nomenclature-recettes.csv', // codes embarqués ; fichier ignoré
            'nomenclature-recettes' => 'nomenclature-recettes.csv',
            'nomenclature-depenses' => 'nomenclature-depenses.csv',
            'comptes' => 'comptes-douanes-petrole.csv',
            'societes-petrolieres' => 'societes-petrolieres.csv',
            'postes-comptables' => 'postes-comptables.csv',
        ];

        return $map[$nom] ?? $nom.'.csv';
    }
}
