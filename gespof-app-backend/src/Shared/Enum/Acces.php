<?php

declare(strict_types=1);

namespace App\Shared\Enum;

/**
 * Accès fins : une valeur par action reellement exposee par un controleur
 * (ex. GENERER_FICHE_DEPOT = FicheDepotController::genererProgress()).
 * Complement grain-fin de ActionAutorisee (CRUD generique CONSULTER/AJOUTER/
 * MODIFIER/SUPPRIMER) : la matrice d'attribution par metier est definie dans
 * RoleAcces::accesRole(), etablie en examinant :
 *  - Module/ServiceReglement/Controller/DashboardController
 *  - Module/ServiceReglement/Controller/FicheDepotController
 *  - Module/ServiceReglement/Controller/HistoriqueController
 *  - Shared/Controller/UtilisateurController
 *  - Shared/Controller/AuditConnexionController
 *  - Shared/Controller/AuditActionController
 *
 * Cote frontend, chaque action protegee verifie ce code via
 * useAuth().hasAcces(...) (voir shared/lib/acces.ts) : l'action reste
 * visible mais son apparence est attenuee et un clic affiche une alerte au
 * lieu de l'executer si l'acces manque. Cote backend, ces codes restent
 * informatifs (l'autorisation reelle est appliquee par les attributs
 * #[IsGranted] et les services) — ils permettent d'exposer au client une
 * liste explicite de ce qu'il peut faire, sans dupliquer la logique.
 */
enum Acces: string
{
    // Service Reglement (SR) — tableau de bord
    case CONSULTER_TABLEAU_BORD_SR = 'CONSULTER_TABLEAU_BORD_SR';

    // Service Reglement (SR) — fiches de depot
    case GENERER_FICHE_DEPOT = 'GENERER_FICHE_DEPOT';
    case CONSULTER_FICHE_DEPOT = 'CONSULTER_FICHE_DEPOT';
    case TELECHARGER_FICHE_DEPOT = 'TELECHARGER_FICHE_DEPOT';
    case GERER_MOUVEMENT_FICHE = 'GERER_MOUVEMENT_FICHE';
    case VALIDER_FICHE_DEPOT = 'VALIDER_FICHE_DEPOT';
    case SUPPRIMER_FICHE_DEPOT = 'SUPPRIMER_FICHE_DEPOT';

    // Service Reglement (SR) — historique
    case CONSULTER_HISTORIQUE = 'CONSULTER_HISTORIQUE';
    case SUPPRIMER_HISTORIQUE = 'SUPPRIMER_HISTORIQUE';

    // Utilisateurs — transverse a tous les portails
    case CONSULTER_UTILISATEURS = 'CONSULTER_UTILISATEURS';
    case CONSULTER_AUDIT_CONNEXIONS = 'CONSULTER_AUDIT_CONNEXIONS';
    case CONSULTER_AUDIT_ACTIONS = 'CONSULTER_AUDIT_ACTIONS';
    case CREER_UTILISATEUR = 'CREER_UTILISATEUR';
    case MODIFIER_UTILISATEUR = 'MODIFIER_UTILISATEUR';
    case DESACTIVER_REACTIVER_UTILISATEUR = 'DESACTIVER_REACTIVER_UTILISATEUR';
    case REINITIALISER_MOT_DE_PASSE_UTILISATEUR = 'REINITIALISER_MOT_DE_PASSE_UTILISATEUR';
    case SUPPRIMER_UTILISATEUR = 'SUPPRIMER_UTILISATEUR';

    public function libelle(): string
    {
        return match ($this) {
            self::CONSULTER_TABLEAU_BORD_SR => 'Consulter le tableau de bord du Service Règlement',
            self::GENERER_FICHE_DEPOT => 'Générer une fiche de dépôt',
            self::CONSULTER_FICHE_DEPOT => 'Consulter les fiches de dépôt',
            self::TELECHARGER_FICHE_DEPOT => 'Télécharger / prévisualiser une fiche de dépôt',
            self::GERER_MOUVEMENT_FICHE => 'Ajouter, modifier ou supprimer un mouvement',
            self::VALIDER_FICHE_DEPOT => 'Valider (envoyer) une fiche de dépôt',
            self::SUPPRIMER_FICHE_DEPOT => 'Supprimer une fiche de dépôt',
            self::CONSULTER_HISTORIQUE => 'Consulter l\'historique des fiches de dépôt',
            self::SUPPRIMER_HISTORIQUE => 'Supprimer une entrée d\'historique',
            self::CONSULTER_UTILISATEURS => 'Consulter les utilisateurs',
            self::CONSULTER_AUDIT_CONNEXIONS => 'Consulter l\'audit des connexions',
            self::CONSULTER_AUDIT_ACTIONS => 'Consulter l\'audit d\'actions',
            self::CREER_UTILISATEUR => 'Créer un utilisateur',
            self::MODIFIER_UTILISATEUR => 'Modifier un utilisateur',
            self::DESACTIVER_REACTIVER_UTILISATEUR => 'Désactiver / réactiver un utilisateur',
            self::REINITIALISER_MOT_DE_PASSE_UTILISATEUR => 'Réinitialiser le mot de passe d\'un utilisateur',
            self::SUPPRIMER_UTILISATEUR => 'Supprimer un utilisateur',
        };
    }
}
