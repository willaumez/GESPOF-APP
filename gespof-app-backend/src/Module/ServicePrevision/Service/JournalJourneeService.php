<?php

declare(strict_types=1);

namespace App\Module\ServicePrevision\Service;

use App\Module\ServicePrevision\Entite\JourneeTresorerie\EvenementJournee;
use App\Module\ServicePrevision\Entite\JourneeTresorerie\JourneeTresorerie;
use App\Module\ServicePrevision\Repository\JourneeTresorerieRepository;
use App\Module\ServicePrevision\Service\Exception\JourneeTresorerieIntrouvableException;
use App\Shared\Entite\Utilisateur;
use App\Shared\Enum\RoleAcces;
use Doctrine\ORM\EntityManagerInterface;
use Psr\Log\LoggerInterface;
use Symfony\Bundle\SecurityBundle\Security;

class JournalJourneeService implements JournalJourneeServiceInterface
{
    public function __construct(
        private readonly EntityManagerInterface $entityManager,
        private readonly JourneeTresorerieRepository $journeeRepository,
        private readonly Security $security,
        private readonly LoggerInterface $logger,
    ) {
    }

    public function enregistrer(JourneeTresorerie $journee, string $type, string $libelle, array $details = []): void
    {
        try {
            $utilisateur = $this->security->getUser();
            $evenement = (new EvenementJournee($journee, $type, $libelle, $details))
                ->attribuerA($utilisateur instanceof Utilisateur ? $utilisateur : null);
            $this->entityManager->persist($evenement);
            $this->entityManager->flush();
        } catch (\Throwable $e) {
            $this->logger->warning('Audit journalier : événement non enregistré.', [
                'journee' => $journee->getReference(),
                'type' => $type,
                'exception' => $e->getMessage(),
            ]);
        }
    }

    public function aEteReouverte(JourneeTresorerie $journee): bool
    {
        $nombre = (int) $this->entityManager->getRepository(EvenementJournee::class)
            ->createQueryBuilder('e')
            ->select('COUNT(e.id)')
            ->andWhere('e.journee = :journee')
            ->andWhere('e.type = :type')
            ->setParameter('journee', $journee)
            ->setParameter('type', self::REOUVERTURE)
            ->getQuery()
            ->getSingleScalarResult();

        return $nombre > 0;
    }

    public function historique(string $referenceJournee): array
    {
        $journee = $this->journeeRepository->find($referenceJournee)
            ?? throw new JourneeTresorerieIntrouvableException('Journée de trésorerie introuvable.');

        /** @var list<EvenementJournee> $evenements */
        $evenements = $this->entityManager->getRepository(EvenementJournee::class)
            ->createQueryBuilder('e')
            ->andWhere('e.journee = :journee')
            ->setParameter('journee', $journee)
            ->orderBy('e.dateEvenement', 'ASC')
            ->addOrderBy('e.id', 'ASC')
            ->getQuery()
            ->getResult();

        return [
            'journee' => [
                'reference' => $journee->getReference(),
                'etat' => $journee->getEtat()->value,
                'etat_libelle' => $journee->getEtat()->libelle(),
                'date_creation' => $journee->getDateCreation()->format(\DateTimeInterface::ATOM),
                'date_derniere_mise_a_jour' => $journee->getDateDerniereMiseAJour()?->format(\DateTimeInterface::ATOM),
            ],
            'evenements' => array_map(
                fn (EvenementJournee $e): array => $this->serialiser($e),
                $evenements,
            ),
        ];
    }

    /** @return array<string, mixed> */
    private function serialiser(EvenementJournee $e): array
    {
        $role = RoleAcces::tryFrom($e->getRole());

        return [
            'id' => $e->getId(),
            'type' => $e->getType(),
            'libelle' => $e->getLibelle(),
            'details' => $e->getDetails(),
            'date' => $e->getDateEvenement()->format(\DateTimeInterface::ATOM),
            'heure' => $e->getDateEvenement()->format('H:i:s'),
            'utilisateur' => [
                'id' => $e->getUtilisateur()?->getId(),
                'nom_complet' => $e->getNomComplet(),
                'matricule' => $e->getMatricule(),
                'email' => $e->getUtilisateur()?->getEmail(),
                'role' => $role?->libelle() ?? ($e->getRole() !== '' ? $e->getRole() : null),
            ],
        ];
    }
}
