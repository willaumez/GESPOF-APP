<?php

declare(strict_types=1);

namespace App\Module\ServiceReglement\Service;

use App\Shared\Entite\Utilisateur;
use App\Module\ServiceReglement\Service\Exception\ActionInterditeException;
use App\Module\ServiceReglement\Service\Exception\AucuneLigneTrouveeException;
use App\Module\ServiceReglement\Service\Exception\DateInvalideException;
use App\Module\ServiceReglement\Service\Exception\DonneesInvalidesException;
use App\Module\ServiceReglement\Service\Exception\FicheIntrouvableException;
use App\Module\ServiceReglement\Service\Exception\FichierIntrouvableException;
use App\Module\ServiceReglement\Service\Exception\MouvementIntrouvableException;
use App\Module\ServiceReglement\Service\Exception\StatutInvalideException;

interface FicheDepotServiceInterface
{


    public function genererFicheAvecProgress(?string $dateStr, Utilisateur $user, callable $progressCallback, ?int $ficheBleueId = null): array;

    public function genererFiche(?string $dateStr, Utilisateur $user, ?int $ficheBleueId = null): array;

    public function lister(?string $statut, string $tri, string $ordre): array;

    public function fichesPaginees(
        int $page,
        string $limitRaw,
        string $search,
        string $statut,
        ?string $dateDebut = null,
        ?string $dateFin = null,
    ): array;

    /**
     * Liste paginée destinée au SP : uniquement fiches envoyées / reçues,
     * avec recherche (référence, générateur, journée) et filtres période / statut.
     *
     * @return array{
     *     fiches: list<array<string, mixed>>,
     *     total: int,
     *     page: int,
     *     pages: int,
     *     limite: int|string
     * }
     */
    public function fichesPagineesPourSp(
        int $page,
        string $limitRaw,
        string $search,
        string $statut,
        ?string $dateDebut = null,
        ?string $dateFin = null,
    ): array;

    /**
     * Détail d'une fiche. `$inclureLignesSystac` = false pour le SP
     * (mouvements groupés uniquement).
     */
    public function detail(string $reference, bool $inclureLignesSystac = true): array;

    /**
     * Fiches générées ou présentées le jour $date (Y-m-d), du plus récent
     * au plus ancien. Si $statuts est non vide, filtre dessus.
     *
     * @param list<string>|null $statuts
     */
    public function listerParDatePresentation(string $date, ?array $statuts = null): array;

    /**
     * Fiches de dépôt rattachées à la Fiche Bleue de la journée $reference
     * (et donc à cette journée de trésorerie). Si $statuts est non vide, filtre dessus.
     *
     * @param list<string>|null $statuts
     */
    public function listerParJourneeTresorerie(string $reference, ?array $statuts = null): array;

    /**
     * Fiche Bleue du SP liée à la journée de trésorerie de $date (Y-m-d),
     * ou null s'il n'y en a pas encore.
     *
     * @return array{date: string, fiche: array<string, mixed>|null}
     */
    public function ficheRecuePourDate(string $date): array;

    /**
     * Fiches Bleues des journées les plus récentes (outil de développement :
     * forcer la fiche utilisée par la génération).
     *
     * @return array{fiches: list<array<string, mixed>>}
     */
    public function fichesRecuesRecentes(int $limite = 30): array;

    /**
     * Si la Fiche Bleue du jour n'est pas encore transmise, crée (une fois)
     * une notification SR invitant à l'attendre.
     */
    public function assurerRappelAttenteFicheBleue(?string $date = null): void;

    /**
     * Détail lecture seule d'une Fiche Bleue déjà transmise au SR
     * (liée à une journée de trésorerie).
     *
     * @return array{fiche: array<string, mixed>}
     */
    public function detailFicheRecue(int $id): array;

    public function changerStatut(string $reference, ?string $nouveauStatut, ?string $commentaire, Utilisateur $user): string;

    /**
     * Le SP accuse réception d'une fiche envoyée (statut → recue).
     *
     * @return array{reference: string, statut: string, journee_tresorerie_reference: ?string, lien: string}
     */
    public function marquerRecueParSp(string $reference, Utilisateur $user): array;

    public function cheminFichier(string $reference): array;

    public function supprimer(string $reference, Utilisateur $user): void;

    /**
     * Suppression sans contrôle de statut (archives SP : cascade sur la journée).
     */
    public function supprimerPourArchives(string $reference): void;

    public function creerMouvement(string $reference, string $famille, array $donnees, Utilisateur $user): array;

    public function modifierMouvement(string $reference, string $famille, int $id, array $donnees, Utilisateur $user): array;

    public function supprimerMouvement(string $reference, string $famille, int $id, Utilisateur $user): void;

    public function supprimerMouvements(string $reference, string $famille, array $idsLignes, Utilisateur $user): array;

    public function rattacherMouvement(string $reference, string $famille, int $idSource, int $idCible, Utilisateur $user): array;

    public function deplacerLigneSystac(string $reference, int $idLigne, int $idGroupeCible, Utilisateur $user): array;

    public function regrouperLignesSystac(string $reference, array $idsLignes, Utilisateur $user): array;

    public function renommerGroupeSystac(string $reference, int $idGroupe, string $designation, Utilisateur $user): array;

    public function creerLigneSystac(string $reference, array $donnees, Utilisateur $user): array;

    public function modifierLigneSystac(string $reference, int $idLigne, array $donnees, Utilisateur $user): array;

    public function supprimerLignesSystac(string $reference, array $idsLignes, Utilisateur $user): array;

    public function regrouperMouvements(string $reference, string $famille, array $idsLignes, Utilisateur $user): array;
}
