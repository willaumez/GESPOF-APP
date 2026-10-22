<?php

declare(strict_types=1);

namespace App\Module\ServicePrevision\Command;

use App\Module\ServicePrevision\Maquettes\MaquetteFicheBleue;
use App\Module\ServicePrevision\Service\BibliothequeSectionServiceInterface;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;

#[AsCommand(
    name: 'sp:bibliotheque:charger',
    description: 'Charge (idempotent) les sections par défaut de la Fiche Bleue dans la bibliothèque.',
)]
final class ChargerBibliothequeMaquetteCommand extends Command
{
    public function __construct(
        private readonly BibliothequeSectionServiceInterface $bibliothequeService,
    ) {
        parent::__construct();
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);
        $crees = $this->bibliothequeService->assurerMaquetteParDefaut(
            MaquetteFicheBleue::CREATEUR_SYSTEME,
        );

        if ($crees === 0) {
            $io->success('Bibliothèque déjà à jour (Solde, Recettes, Dépenses).');
        } else {
            $io->success(sprintf(
                'Bibliothèque mise à jour : %d nœud%s (sections Recette et Dépense séparées par type).',
                $crees,
                $crees > 1 ? 's' : '',
            ));
        }

        return Command::SUCCESS;
    }
}
