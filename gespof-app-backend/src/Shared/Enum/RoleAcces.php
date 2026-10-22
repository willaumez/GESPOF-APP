<?php

declare(strict_types=1);

namespace App\Shared\Enum;

enum RoleAcces: string
{
    case ADMINISTRATEUR = 'ADMINISTRATEUR';
    case AGENT_SOF = 'AGENT_SOF';
    case CHEF_SOF = 'CHEF_SOF';
    case AGENT_SR = 'AGENT_SR';
    case CHEF_SR = 'CHEF_SR';
    case AGENT_SP = 'AGENT_SP';
    case CHEF_SP = 'CHEF_SP';
    case DIRECTEUR_DOMF = 'DIRECTEUR_DOMF';
    case DIRECTION_DG = 'DIRECTION_DG';
    case SUPERVISEUR = 'SUPERVISEUR';

    public function libelle(): string
    {
        return match($this) {
            self::ADMINISTRATEUR => 'Administrateur',
            self::AGENT_SOF => 'Agent du Service des Opérations Financières',
            self::CHEF_SOF => 'Chef du Service des Opérations Financières',
            self::AGENT_SR => 'Agent du Service Règlement',
            self::CHEF_SR => 'Chef du Service Règlement',
            self::AGENT_SP => 'Agent du Service de Prévision',
            self::CHEF_SP => 'Chef du Service de Prévision',
            self::DIRECTEUR_DOMF => 'Directeur de la Direction des Opérations Monétaires et Financières',
            self::DIRECTION_DG => 'Direction Générale',
            self::SUPERVISEUR => 'Superviseur',
        };
    }

    /**
     * Portail que ce métier implique automatiquement. `null` pour les métiers
     * transverses (DIRECTEUR_DOMF, DIRECTION_DG, SUPERVISEUR) qui n'ont pas de
     * portail dédié — comportement déjà en vigueur côté frontend (menu.json),
     * juste rendu explicite ici pour piloter l'attribution automatique.
     */
    public function portail(): ?Portail
    {
        return match ($this) {
            self::ADMINISTRATEUR => Portail::ADMIN,
            self::AGENT_SOF, self::CHEF_SOF => Portail::SOF,
            self::AGENT_SP, self::CHEF_SP => Portail::SP,
            self::AGENT_SR, self::CHEF_SR => Portail::SR,
            self::DIRECTEUR_DOMF, self::DIRECTION_DG, self::SUPERVISEUR => null,
        };
    }

    /**
     * Actions que ce métier autorise automatiquement. Les métiers "chef" et
     * l'administrateur ont les 4 actions (dont la gestion des utilisateurs de
     * leur portail) ; les agents ont tout sauf la suppression ; les métiers
     * transverses (direction/supervision) sont en lecture seule.
     *
     * @return ActionAutorisee[]
     */
    public function actions(): array
    {
        return match ($this) {
            self::ADMINISTRATEUR, self::CHEF_SOF, self::CHEF_SP, self::CHEF_SR => [
                ActionAutorisee::CONSULTER,
                ActionAutorisee::AJOUTER,
                ActionAutorisee::MODIFIER,
                ActionAutorisee::SUPPRIMER,
            ],
            self::AGENT_SOF, self::AGENT_SP, self::AGENT_SR => [
                ActionAutorisee::CONSULTER,
                ActionAutorisee::AJOUTER,
                ActionAutorisee::MODIFIER,
            ],
            self::DIRECTEUR_DOMF, self::DIRECTION_DG, self::SUPERVISEUR => [
                ActionAutorisee::CONSULTER,
            ],
        };
    }

    /** Accès agent du Service Règlement — voir DashboardController/FicheDepotController/HistoriqueController. */
    private const array ACCES_SR_AGENT = [
        Acces::CONSULTER_TABLEAU_BORD_SR,
        Acces::GENERER_FICHE_DEPOT,
        Acces::CONSULTER_FICHE_DEPOT,
        Acces::TELECHARGER_FICHE_DEPOT,
        Acces::GERER_MOUVEMENT_FICHE,
        Acces::CONSULTER_HISTORIQUE,
    ];

    /** Accès supplementaires du chef SR (actions destructives/de validation), au-dessus de ACCES_SR_AGENT. */
    private const array ACCES_SR_CHEF_SUPPLEMENTAIRES = [
        Acces::VALIDER_FICHE_DEPOT,
        Acces::SUPPRIMER_FICHE_DEPOT,
        Acces::SUPPRIMER_HISTORIQUE,
    ];

    /** Gestion des utilisateurs — voir UtilisateurController (transverse a tous les portails). */
    private const array ACCES_UTILISATEURS = [
        Acces::CONSULTER_UTILISATEURS,
        Acces::CONSULTER_AUDIT_CONNEXIONS,
        Acces::CONSULTER_AUDIT_ACTIONS,
        Acces::CREER_UTILISATEUR,
        Acces::MODIFIER_UTILISATEUR,
        Acces::DESACTIVER_REACTIVER_UTILISATEUR,
        Acces::REINITIALISER_MOT_DE_PASSE_UTILISATEUR,
        Acces::SUPPRIMER_UTILISATEUR,
    ];

    /** Lecture seule, tous portails confondus — metiers transverses (direction/supervision). */
    private const array ACCES_LECTURE_TRANSVERSE = [
        Acces::CONSULTER_TABLEAU_BORD_SR,
        Acces::CONSULTER_FICHE_DEPOT,
        Acces::TELECHARGER_FICHE_DEPOT,
        Acces::CONSULTER_HISTORIQUE,
        Acces::CONSULTER_UTILISATEURS,
    ];

    /**
     * Liste fine des actions autorisees pour ce metier — une valeur par
     * action reellement exposee par un controleur (ex. GENERER_FICHE_DEPOT).
     * Complement grain-fin de actions() (CRUD generique), etabli en
     * examinant chaque controleur :
     *  - AGENT_* : consulte + agit sur son portail, jamais de suppression ;
     *  - CHEF_* : tout ce que fait l'agent de son portail + validation,
     *    suppression et gestion des utilisateurs de ce portail ;
     *  - AGENT_SOF/AGENT_SP/CHEF_SOF/CHEF_SP : portails sans controleur
     *    metier pour l'instant (pages frontend en attente du backend) —
     *    seule la gestion des utilisateurs est deja active pour les chefs ;
     *  - ADMINISTRATEUR : union de tous les acces ;
     *  - metiers transverses (DIRECTEUR_DOMF, DIRECTION_DG, SUPERVISEUR) :
     *    lecture seule, miroir de actions() = [CONSULTER].
     *
     * @return Acces[]
     */
    public function accesRole(): array
    {
        return match ($this) {
            self::ADMINISTRATEUR => [
                ...self::ACCES_SR_AGENT,
                ...self::ACCES_SR_CHEF_SUPPLEMENTAIRES,
                ...self::ACCES_UTILISATEURS,
            ],
            self::AGENT_SR => self::ACCES_SR_AGENT,
            self::CHEF_SR => [
                ...self::ACCES_SR_AGENT,
                ...self::ACCES_SR_CHEF_SUPPLEMENTAIRES,
                ...self::ACCES_UTILISATEURS,
            ],
            self::AGENT_SOF, self::AGENT_SP => [],
            self::CHEF_SOF, self::CHEF_SP => self::ACCES_UTILISATEURS,
            self::DIRECTEUR_DOMF, self::DIRECTION_DG, self::SUPERVISEUR => self::ACCES_LECTURE_TRANSVERSE,
        };
    }
}
