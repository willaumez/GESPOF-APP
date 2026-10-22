<?php

declare(strict_types=1);

namespace App\Shared\Repository;

use App\Shared\Entite\Notification;
use App\Shared\Entite\NotificationLecture;
use App\Shared\Entite\Utilisateur;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<Notification>
 */
class NotificationRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, Notification::class);
    }

    public function save(Notification $notification, bool $flush = false): void
    {
        $this->getEntityManager()->persist($notification);
        if ($flush) {
            $this->getEntityManager()->flush();
        }
    }

    /**
     * @return list<Notification>
     */
    public function listerPourPortail(string $portail, int $limite = 40): array
    {
        /** @var list<Notification> $lignes */
        $lignes = $this->createQueryBuilder('n')
            ->andWhere('n.portail = :portail')
            ->setParameter('portail', $portail)
            ->orderBy('n.dateCreation', 'DESC')
            ->setMaxResults($limite)
            ->getQuery()
            ->getResult();

        return $lignes;
    }

    /**
     * @param list<int> $notificationIds
     * @return list<int>
     */
    public function idsLuesPar(Utilisateur $utilisateur, array $notificationIds): array
    {
        if ($notificationIds === []) {
            return [];
        }

        $ids = $this->getEntityManager()->createQueryBuilder()
            ->select('IDENTITY(l.notification)')
            ->from(NotificationLecture::class, 'l')
            ->andWhere('l.utilisateur = :user')
            ->andWhere('l.notification IN (:ids)')
            ->setParameter('user', $utilisateur)
            ->setParameter('ids', $notificationIds)
            ->getQuery()
            ->getSingleColumnResult();

        return array_map('intval', $ids);
    }

    public function compterNonLues(string $portail, Utilisateur $utilisateur): int
    {
        return (int) $this->createQueryBuilder('n')
            ->select('COUNT(n.id)')
            ->andWhere('n.portail = :portail')
            ->andWhere(
                'NOT EXISTS (
                    SELECT 1 FROM App\Shared\Entite\NotificationLecture l
                    WHERE l.notification = n AND l.utilisateur = :user
                )',
            )
            ->setParameter('portail', $portail)
            ->setParameter('user', $utilisateur)
            ->getQuery()
            ->getSingleScalarResult();
    }

    public function estLue(Notification $notification, Utilisateur $utilisateur): bool
    {
        $id = $this->getEntityManager()->createQueryBuilder()
            ->select('l.id')
            ->from(NotificationLecture::class, 'l')
            ->andWhere('l.notification = :n')
            ->andWhere('l.utilisateur = :user')
            ->setParameter('n', $notification)
            ->setParameter('user', $utilisateur)
            ->setMaxResults(1)
            ->getQuery()
            ->getOneOrNullResult();

        return $id !== null;
    }

    public function marquerLue(Notification $notification, Utilisateur $utilisateur): void
    {
        if ($this->estLue($notification, $utilisateur)) {
            return;
        }

        $this->getEntityManager()->persist(new NotificationLecture($notification, $utilisateur));
        $this->getEntityManager()->flush();
    }

    public function marquerToutesLues(string $portail, Utilisateur $utilisateur): void
    {
        $notifications = $this->listerPourPortail($portail, 200);
        $ids = array_values(array_filter(array_map(
            static fn (Notification $n): ?int => $n->getId(),
            $notifications,
        )));
        $dejaLues = array_flip($this->idsLuesPar($utilisateur, $ids));

        foreach ($notifications as $notification) {
            $id = $notification->getId();
            if ($id === null || isset($dejaLues[$id])) {
                continue;
            }
            $this->getEntityManager()->persist(new NotificationLecture($notification, $utilisateur));
        }

        $this->getEntityManager()->flush();
    }

    public function existePourCible(
        string $portail,
        string $type,
        string $cibleType,
        string $cibleReference,
    ): bool {
        $id = $this->createQueryBuilder('n')
            ->select('n.id')
            ->andWhere('n.portail = :portail')
            ->andWhere('n.type = :type')
            ->andWhere('n.cibleType = :cibleType')
            ->andWhere('n.cibleReference = :cibleReference')
            ->setParameter('portail', $portail)
            ->setParameter('type', $type)
            ->setParameter('cibleType', $cibleType)
            ->setParameter('cibleReference', $cibleReference)
            ->setMaxResults(1)
            ->getQuery()
            ->getOneOrNullResult();

        return $id !== null;
    }
}
