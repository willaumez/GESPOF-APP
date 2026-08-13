<?php

declare(strict_types=1);

namespace App\Shared\Repository;

use App\Shared\Model\Utilisateur;
use App\Shared\Enum\RoleAcces;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;
use Symfony\Component\Security\Core\Exception\UnsupportedUserException;
use Symfony\Component\Security\Core\User\PasswordAuthenticatedUserInterface;
use Symfony\Component\Security\Core\User\PasswordUpgraderInterface;
use Symfony\Component\Security\Core\User\UserInterface;

class UtilisateurRepository extends ServiceEntityRepository implements PasswordUpgraderInterface
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, Utilisateur::class);
    }

    public function save(Utilisateur $utilisateur, bool $flush = false): void
    {
        $this->getEntityManager()->persist($utilisateur);
        if ($flush) {
            $this->getEntityManager()->flush();
        }
    }

    public function remove(Utilisateur $utilisateur, bool $flush = false): void
    {
        $this->getEntityManager()->remove($utilisateur);
        if ($flush) {
            $this->getEntityManager()->flush();
        }
    }

    public function listerPagine(
        array $roles,
        string $search,
        ?RoleAcces $roleFiltre,
        ?bool $actifFiltre,
        int $page,
        int $limit,
        bool $toutAfficher,
    ): array {
        $qb = $this->createQueryBuilder('u')
            ->orderBy('u.nom', 'ASC')
            ->addOrderBy('u.prenom', 'ASC');

        if ($actifFiltre !== null) {
            $qb->andWhere($actifFiltre ? 'u.actif = true' : 'u.actif = false');
        }

        $search = trim($search);
        if ($search !== '') {
            $qb->andWhere('LOWER(u.nom) LIKE :search OR LOWER(u.prenom) LIKE :search OR LOWER(u.email) LIKE :search OR LOWER(u.matricule) LIKE :search')
                ->setParameter('search', '%' . mb_strtolower($search) . '%');
        }

        $rolesAutorises = array_map(static fn (RoleAcces $r): string => $r->value, $roles);

        $tousLesUtilisateurs = array_values(array_filter(
            $qb->getQuery()->getResult(),
            static function (Utilisateur $u) use ($rolesAutorises, $roleFiltre): bool {
                $rolesUtilisateur = array_map(static fn (RoleAcces $r): string => $r->value, $u->getRolesAcces());
                if (array_intersect($rolesUtilisateur, $rolesAutorises) === []) {
                    return false;
                }

                return $roleFiltre === null || in_array($roleFiltre->value, $rolesUtilisateur, true);
            },
        ));

        $total = count($tousLesUtilisateurs);
        $utilisateurs = $toutAfficher
            ? $tousLesUtilisateurs
            : array_slice($tousLesUtilisateurs, ($page - 1) * $limit, $limit);

        return [
            'utilisateurs' => $utilisateurs,
            'total' => $total,
        ];
    }

    public function upgradePassword(PasswordAuthenticatedUserInterface $user, string $newHashedPassword): void
    {
        if (!$user instanceof Utilisateur) {
            throw new UnsupportedUserException(sprintf('Instances of "%s" are not supported.', $user::class));
        }

        $user->setMotDePasseHash($newHashedPassword);
        $this->getEntityManager()->flush();
    }

    public function loadUserByIdentifier(string $identifier): ?Utilisateur
    {
        return $this->createQueryBuilder('u')
            ->where('(u.email = :id OR u.matricule = :id) AND u.actif = true')
            ->setParameter('id', $identifier)
            ->getQuery()
            ->getOneOrNullResult();
    }

    public function refreshUser(UserInterface $user): UserInterface
    {
        if (!$user instanceof Utilisateur) {
            throw new UnsupportedUserException(sprintf('Invalid user class "%s".', $user::class));
        }

        $refreshed = $this->find($user->getId());
        if (!$refreshed instanceof Utilisateur) {
            throw new UnsupportedUserException('User not found.');
        }

        return $refreshed;
    }

    public function flush(): void
    {
        $this->getEntityManager()->flush();
    }
}