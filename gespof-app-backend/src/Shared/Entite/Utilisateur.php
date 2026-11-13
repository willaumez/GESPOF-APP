<?php

declare(strict_types=1);

namespace App\Shared\Entite;

use App\Shared\Enum\Acces;
use App\Shared\Enum\Genre;
use App\Shared\Enum\RoleAcces;
use App\Shared\Repository\UtilisateurRepository;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Security\Core\User\PasswordAuthenticatedUserInterface;
use Symfony\Component\Security\Core\User\UserInterface;

#[ORM\Entity(repositoryClass: UtilisateurRepository::class)]
#[ORM\Table(name: 'utilisateur')]
class Utilisateur implements UserInterface, PasswordAuthenticatedUserInterface, \JsonSerializable
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column(type: Types::INTEGER)]
    private ?int $id = null;

    #[ORM\Column(name: 'matricule', length: 255, unique: true)]
    private string $matricule = '';

    #[ORM\Column(name: 'email', length: 255, unique: true)]
    private string $email = '';

    #[ORM\Column(name: 'nom', length: 255)]
    private string $nom = '';

    #[ORM\Column(name: 'prenom', length: 255)]
    private string $prenom = '';

    #[ORM\Column(name: 'mot_de_passe_hash', length: 255)]
    private string $motDePasseHash = '';

    #[ORM\Column(name: 'connection', type: Types::STRING, length: 255, options: ['default' => 'first'])]
    private string $connection = 'first';

    #[ORM\Column(name: 'roles', type: Types::JSON)]
    private array $roles = [];

    /**
     * Liste des accès autorisés pour ce compte précis. Initialisée avec les accès
     * accordés par le(s) métier(s) ci-dessus (RoleAcces::accesRole()) puis
     * ajustable individuellement par un administrateur : deux utilisateurs du même
     * métier peuvent donc avoir des habilitations différentes. C'est cette liste —
     * et elle seule — qui fait foi (hasAcces(), JWT, /auth/me).
     */
    #[ORM\Column(name: 'acces', type: Types::JSON)]
    private array $acces = [];

    #[ORM\Column(name: 'actif', type: Types::BOOLEAN)]
    private bool $actif = true;

    #[ORM\Column(name: 'date_creation', type: Types::DATETIME_IMMUTABLE)]
    private ?\DateTimeImmutable $dateCreation = null;

    #[ORM\Column(name: 'derniere_connexion', type: Types::DATETIME_IMMUTABLE, nullable: true)]
    private ?\DateTimeImmutable $derniereConnexion = null;

    /** Genre : la civilité M./Mme en est dérivée. */
    #[ORM\Column(name: 'genre', length: 10, nullable: true, enumType: Genre::class)]
    private ?Genre $genre = null;

    /** Chemin relatif sous var/avatars ; null = avatar en initiales. */
    #[ORM\Column(name: 'photo_chemin', length: 255, nullable: true)]
    private ?string $photoChemin = null;

    #[ORM\Column(name: 'photo_empreinte', length: 64, nullable: true)]
    private ?string $photoEmpreinte = null;

    public function __construct()
    {
        $this->dateCreation = new \DateTimeImmutable();
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getMatricule(): string
    {
        return $this->matricule;
    }

    public function setMatricule(string $matricule): static
    {
        $this->matricule = $matricule;

        return $this;
    }

    public function getEmail(): string
    {
        return $this->email;
    }

    public function setEmail(string $email): static
    {
        $this->email = $email;

        return $this;
    }

    public function getNom(): string
    {
        return $this->nom;
    }

    public function setNom(string $nom): static
    {
        $this->nom = $nom;

        return $this;
    }

    public function getPrenom(): string
    {
        return $this->prenom;
    }

    public function setPrenom(string $prenom): static
    {
        $this->prenom = $prenom;

        return $this;
    }

    public function getMotDePasseHash(): string
    {
        return $this->motDePasseHash;
    }

    public function setMotDePasseHash(string $motDePasseHash): static
    {
        $this->motDePasseHash = $motDePasseHash;

        return $this;
    }

    public function getConnection(): string
    {
        return $this->connection;
    }

    public function setConnection(string $connection): static
    {
        $this->connection = $connection;

        return $this;
    }

    public function getRolesAcces(): array
    {
        return array_values(array_map(
            static fn (string $role): RoleAcces => RoleAcces::from($role),
            $this->roles,
        ));
    }

    public function setRolesAcces(array $roles): static
    {
        $this->roles = array_values(array_unique(array_map(
            static fn (RoleAcces $role): string => $role->value,
            $roles,
        )));

        return $this;
    }

    public function hasRoleAcces(RoleAcces $role): bool
    {
        return in_array($role->value, $this->roles, true);
    }

    /**
     * Catalogue des acces que le(s) metier(s) de ce compte accordent par
     * defaut (union des RoleAcces::accesRole()) : c'est la liste que
     * l'administrateur peut cocher/decocher pour cet utilisateur precis, et
     * celle utilisee pour (re)initialiser getAcces() quand le metier change.
     * Derive des roles, jamais stocke — la liste reellement appliquee est
     * getAcces().
     *
     * @return Acces[]
     */
    public function getAccesCatalogue(): array
    {
        $acces = [];
        foreach ($this->getRolesAcces() as $role) {
            foreach ($role->accesRole() as $a) {
                $acces[$a->value] = $a;
            }
        }

        return array_values($acces);
    }

    /**
     * Liste des acces autorises pour ce compte precis (colonne `acces`) :
     * initialisee avec le catalogue du metier puis ajustee individuellement
     * par un administrateur. Complement grain-fin de getRolesAcces()/
     * actions_autorisees (CRUD generique CONSULTER/AJOUTER/MODIFIER/
     * SUPPRIMER) : chaque valeur correspond a une action precise exposee par
     * un controleur (ex. GENERER_FICHE_DEPOT).
     *
     * @return Acces[]
     */
    public function getAcces(): array
    {
        return array_values(array_filter(array_map(
            static fn (string $valeur): ?Acces => Acces::tryFrom($valeur),
            $this->acces,
        )));
    }

    /**
     * @param Acces[] $acces
     */
    public function setAcces(array $acces): static
    {
        $this->acces = array_values(array_unique(array_map(
            static fn (Acces $a): string => $a->value,
            $acces,
        )));

        return $this;
    }

    public function hasAcces(Acces $acces): bool
    {
        return in_array($acces->value, $this->acces, true);
    }

    public function isActif(): bool
    {
        return $this->actif;
    }

    public function setActif(bool $actif): static
    {
        $this->actif = $actif;

        return $this;
    }

    public function getDateCreation(): ?\DateTimeImmutable
    {
        return $this->dateCreation;
    }

    public function setDateCreation(\DateTimeImmutable $dateCreation): static
    {
        $this->dateCreation = $dateCreation;

        return $this;
    }

    public function getDerniereConnexion(): ?\DateTimeImmutable
    {
        return $this->derniereConnexion;
    }

    public function setDerniereConnexion(?\DateTimeImmutable $derniereConnexion): static
    {
        $this->derniereConnexion = $derniereConnexion;

        return $this;
    }

    public function getGenre(): ?Genre
    {
        return $this->genre;
    }

    public function setGenre(?Genre $genre): static
    {
        $this->genre = $genre;

        return $this;
    }

    /** Civilité dérivée du genre ; jamais stockée. */
    public function getCivilite(): ?string
    {
        return $this->genre?->civilite();
    }

    public function aUnePhoto(): bool
    {
        return null !== $this->photoChemin && null !== $this->photoEmpreinte;
    }

    public function getPhotoChemin(): ?string
    {
        return $this->photoChemin;
    }

    public function getPhotoEmpreinte(): ?string
    {
        return $this->photoEmpreinte;
    }

    public function definirPhoto(string $chemin, string $empreinte): static
    {
        $this->photoChemin = $chemin;
        $this->photoEmpreinte = $empreinte;

        return $this;
    }

    /** Retire le lien vers la photo ; le fichier reste sur disque. */
    public function retirerPhoto(): static
    {
        $this->photoChemin = null;
        $this->photoEmpreinte = null;

        return $this;
    }

    public function getUserIdentifier(): string
    {
        return $this->email;
    }

    public function getRoles(): array
    {
        $roles = array_map(static fn (string $role): string => sprintf('ROLE_%s', $role), $this->roles);
        $roles[] = 'ROLE_USER';

        return array_values(array_unique($roles));
    }

    public function getPassword(): string
    {
        return $this->motDePasseHash;
    }

    public function eraseCredentials(): void
    {
    }

    public function jsonSerialize(): array
    {
        $roles = $this->getRolesAcces();

        // Portail(s) et actions derives automatiquement des metiers ci-dessus
        // (RoleAcces::portail()/actions()) — pas de saisie ni de stockage
        // separe, recalcule a chaque lecture.
        $portails = [];
        $actionsAutorisees = [];
        foreach ($roles as $role) {
            if ($role->portail() !== null) {
                $portails[$role->portail()->value] = $role->portail()->value;
            }
            foreach ($role->actions() as $action) {
                $actionsAutorisees[$action->value] = $action->value;
            }
        }

        return [
            'id' => $this->id,
            'matricule' => $this->matricule,
            'email' => $this->email,
            'nom' => $this->nom,
            'prenom' => $this->prenom,
            'roles' => array_map(
                static fn (RoleAcces $role): array => ['valeur' => $role->value, 'libelle' => $role->libelle()],
                $roles,
            ),
            'portails' => array_values($portails),
            'actions_autorisees' => array_values($actionsAutorisees),
            // Liste des acces reellement autorises pour ce compte (colonne `acces`) :
            // c'est elle qui pilote les autorisations (JWT, hasAcces()).
            'acces' => array_map(
                static fn (Acces $a): array => ['valeur' => $a->value, 'libelle' => $a->libelle()],
                $this->getAcces(),
            ),
            // Catalogue complet accorde par le metier : utilise par l'ecran
            // d'administration pour afficher les cases a cocher.
            'acces_catalogue' => array_map(
                static fn (Acces $a): array => ['valeur' => $a->value, 'libelle' => $a->libelle()],
                $this->getAccesCatalogue(),
            ),
            'actif' => $this->actif,
            'connection' => $this->connection,
            'date_creation' => $this->dateCreation?->format('d/m/Y H:i:s'),
            'derniere_connexion' => $this->derniereConnexion?->format('d/m/Y H:i:s'),
            'genre' => $this->genre?->value,
            'civilite' => $this->getCivilite(),
            'a_photo' => $this->aUnePhoto(),
        ];
    }
}
