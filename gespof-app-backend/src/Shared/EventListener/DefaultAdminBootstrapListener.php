<?php

declare(strict_types=1);

namespace App\Shared\EventListener;

use App\Shared\Entite\Utilisateur;
use App\Shared\Enum\RoleAcces;
use App\Shared\Repository\UtilisateurRepository;
use Doctrine\ORM\EntityManagerInterface;
use Psr\Log\LoggerInterface;
use Symfony\Component\EventDispatcher\Attribute\AsEventListener;
use Symfony\Component\HttpKernel\Event\RequestEvent;
use Symfony\Component\HttpKernel\KernelEvents;
use Symfony\Component\PasswordHasher\Hasher\UserPasswordHasherInterface;

#[AsEventListener(event: KernelEvents::REQUEST, priority: 2048)]
final class DefaultAdminBootstrapListener
{
    private const COMPTES_PAR_DEFAUT = [
        [
            'matricule' => '999070G',
            'email' => '999070G@gespof.local',
            'nom' => 'Administrateur',
            'prenom' => 'Système',
            'roles' => [RoleAcces::ADMINISTRATEUR],
            'mot_de_passe' => 'admin123',
        ],
        [
            'matricule' => '999070',
            'email' => '999070@gespof.local',
            'nom' => 'Agent',
            'prenom' => 'Service Règlement',
            'roles' => [RoleAcces::AGENT_SR],
            'mot_de_passe' => 'admin123',
        ],
        [
            'matricule' => '999070B',
            'email' => '999070B@gespof.local',
            'nom' => 'Chef',
            'prenom' => 'Service Règlement',
            'roles' => [RoleAcces::CHEF_SR],
            'mot_de_passe' => 'admin123',
        ],
        [
            'matricule' => '999071',
            'email' => '999071@gespof.local',
            'nom' => 'Agent',
            'prenom' => 'Service Prévision',
            'roles' => [RoleAcces::AGENT_SP],
            'mot_de_passe' => 'admin123',
        ],
        [
            'matricule' => '999071B',
            'email' => '999071B@gespof.local',
            'nom' => 'Chef',
            'prenom' => 'Service Prévision',
            'roles' => [RoleAcces::CHEF_SP],
            'mot_de_passe' => 'admin123',
        ],
        [
            'matricule' => '999072',
            'email' => '999072@gespof.local',
            'nom' => 'Agent',
            'prenom' => 'Service Opérations Financières',
            'roles' => [RoleAcces::AGENT_SOF],
            'mot_de_passe' => 'admin123',
        ],
        [
            'matricule' => '999072B',
            'email' => '999072B@gespof.local',
            'nom' => 'Chef',
            'prenom' => 'Service Opérations Financières',
            'roles' => [RoleAcces::CHEF_SOF],
            'mot_de_passe' => 'admin123',
        ],
    ];

    private static bool $verifie = false;

    public function __construct(
        private readonly UtilisateurRepository $utilisateurRepository,
        private readonly EntityManagerInterface $entityManager,
        private readonly UserPasswordHasherInterface $passwordHasher,
        private readonly LoggerInterface $logger,
    ) {
    }

    public function __invoke(RequestEvent $event): void
    {
        if (!$event->isMainRequest()) {
            return;
        }

        // Le listener est censé s'exécuter une seule fois par process, mais
        // si de nouveaux "comptes par défaut" sont ajoutés, on doit pouvoir
        // les créer sans redémarrer l'application.
        if (self::$verifie) {
            $agentSofExiste = $this->utilisateurRepository->findOneBy(['matricule' => '999072']) !== null;
            $chefSofExiste = $this->utilisateurRepository->findOneBy(['matricule' => '999072B']) !== null;
            if ($agentSofExiste && $chefSofExiste) {
                return;
            }
        }

        try {
            $creations = 0;
            foreach (self::COMPTES_PAR_DEFAUT as $compte) {
                if (null === $this->utilisateurRepository->findOneBy(['matricule' => $compte['matricule']])) {
                    $this->creerUtilisateur($compte);
                    ++$creations;
                }
            }

            if ($creations > 0) {
                $this->entityManager->flush();
            }

            self::$verifie = true;
        } catch (\Throwable $e) {
            $this->logger->debug('Vérification des comptes par défaut différée.', ['exception' => $e->getMessage()]);
        }
    }

    private function creerUtilisateur(array $compte): void
    {
        $utilisateur = new Utilisateur();
        $utilisateur->setMatricule($compte['matricule']);
        $utilisateur->setEmail($compte['email']);
        $utilisateur->setNom($compte['nom']);
        $utilisateur->setPrenom($compte['prenom']);
        $utilisateur->setRolesAcces($compte['roles']);
        // Acces autorises = ceux accordes par le(s) metier(s), comme a la creation
        // depuis l'ecran d'administration (voir UtilisateurService::creer()).
        $utilisateur->setAcces($utilisateur->getAccesCatalogue());
        $utilisateur->setActif(true);
        $utilisateur->setConnection('connected');
        $utilisateur->setMotDePasseHash($this->passwordHasher->hashPassword($utilisateur, $compte['mot_de_passe']));

        $this->entityManager->persist($utilisateur);

        $this->logger->warning('Utilisateur par défaut créé automatiquement.', [
            'matricule' => $compte['matricule'],
            'roles' => array_map(static fn (RoleAcces $r): string => $r->value, $compte['roles']),
        ]);
    }
}
