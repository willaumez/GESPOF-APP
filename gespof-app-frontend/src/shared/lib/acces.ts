/**
 * Accès fins — miroir côté client de App\Shared\Enum\Acces
 * (gespof-app-backend/src/Shared/Enum/Acces.php). Une valeur par action
 * précise exposée par un contrôleur (ex. GENERER_FICHE_DEPOT). Le backend
 * reste la seule source de vérité appliquée : cette liste sert uniquement à
 * l'UX (désactiver visuellement une action et expliquer pourquoi), jamais à
 * décider seule si une requête doit passer.
 *
 * `user.acces` (voir shared/hooks/auth-context.ts) est rempli à partir
 * du champ `acces` renvoyé par /api/v1/auth/me (Utilisateur::jsonSerialize()),
 * c'est-à-dire la colonne `utilisateur.acces` côté base.
 */
export type Acces =
  | "CONSULTER_TABLEAU_BORD_SR"
  | "GENERER_FICHE_DEPOT"
  | "CONSULTER_FICHE_DEPOT"
  | "TELECHARGER_FICHE_DEPOT"
  | "GERER_MOUVEMENT_FICHE"
  | "VALIDER_FICHE_DEPOT"
  | "SUPPRIMER_FICHE_DEPOT"
  | "CONSULTER_HISTORIQUE"
  | "SUPPRIMER_HISTORIQUE"
  | "CONSULTER_UTILISATEURS"
  | "CONSULTER_AUDIT_CONNEXIONS"
  | "CONSULTER_AUDIT_ACTIONS"
  | "CREER_UTILISATEUR"
  | "MODIFIER_UTILISATEUR"
  | "DESACTIVER_REACTIVER_UTILISATEUR"
  | "REINITIALISER_MOT_DE_PASSE_UTILISATEUR"
  | "SUPPRIMER_UTILISATEUR";

export const LIBELLE_ACCES: Record<Acces, string> = {
  CONSULTER_TABLEAU_BORD_SR: "Consulter le tableau de bord du Service Règlement",
  GENERER_FICHE_DEPOT: "Générer une fiche de dépôt",
  CONSULTER_FICHE_DEPOT: "Consulter les fiches de dépôt",
  TELECHARGER_FICHE_DEPOT: "Télécharger / prévisualiser une fiche de dépôt",
  GERER_MOUVEMENT_FICHE: "Ajouter, modifier ou supprimer un mouvement",
  VALIDER_FICHE_DEPOT: "Valider (envoyer) une fiche de dépôt",
  SUPPRIMER_FICHE_DEPOT: "Supprimer une fiche de dépôt",
  CONSULTER_HISTORIQUE: "Consulter l'historique des fiches de dépôt",
  SUPPRIMER_HISTORIQUE: "Supprimer une entrée d'historique",
  CONSULTER_UTILISATEURS: "Consulter les utilisateurs",
  CONSULTER_AUDIT_CONNEXIONS: "Consulter l'audit des connexions",
  CONSULTER_AUDIT_ACTIONS: "Consulter l'audit d'actions",
  CREER_UTILISATEUR: "Créer un utilisateur",
  MODIFIER_UTILISATEUR: "Modifier un utilisateur",
  DESACTIVER_REACTIVER_UTILISATEUR: "Désactiver / réactiver un utilisateur",
  REINITIALISER_MOT_DE_PASSE_UTILISATEUR: "Réinitialiser le mot de passe d'un utilisateur",
  SUPPRIMER_UTILISATEUR: "Supprimer un utilisateur",
};

/** Message affiché lorsqu'un utilisateur clique sur une action à laquelle il n'a pas accès. */
export function messageAccesRefuse(acces?: Acces): string {
  return acces
    ? `Accès refusé : vous n'avez pas l'autorisation pour « ${LIBELLE_ACCES[acces]} ».`
    : "Vous n'avez pas l'accès nécessaire pour effectuer cette action.";
}
