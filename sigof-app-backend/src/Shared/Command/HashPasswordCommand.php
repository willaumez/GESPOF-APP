<?php

declare(strict_types=1);

namespace App\Shared\Command;

use App\Shared\Repository\UtilisateurRepository;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputArgument;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;
use Symfony\Component\PasswordHasher\Hasher\UserPasswordHasherInterface;

#[AsCommand(
    name: 'app:hash-password',
    description: 'Hash le mot de passe en clair d\'un utilisateur et met à jour la base de données.',
)]
class HashPasswordCommand extends Command
{
    public function __construct(
        private readonly UtilisateurRepository $utilisateurRepository,
        private readonly UserPasswordHasherInterface $passwordHasher,
    ) {
        parent::__construct();
    }

    protected function configure(): void
    {
        $this
            ->addArgument('identifiant', InputArgument::REQUIRED, 'Email ou matricule de l\'utilisateur')
            ->addArgument('mot_de_passe', InputArgument::REQUIRED, 'Mot de passe en clair à hasher');
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);

        $identifiant = (string) $input->getArgument('identifiant');
        $motDePasse  = (string) $input->getArgument('mot_de_passe');

        $user = $this->utilisateurRepository->loadUserByIdentifier($identifiant);
        if ($user === null) {
            $io->error(sprintf('Aucun utilisateur actif trouvé pour : %s', $identifiant));
            return Command::FAILURE;
        }

        $hash = $this->passwordHasher->hashPassword($user, $motDePasse);
        $user->setMotDePasseHash($hash);
        $this->utilisateurRepository->flush();

        $io->success(sprintf(
            'Mot de passe mis à jour pour %s (%s).',
            $user->getEmail(),
            $user->getMatricule(),
        ));

        return Command::SUCCESS;
    }
}
