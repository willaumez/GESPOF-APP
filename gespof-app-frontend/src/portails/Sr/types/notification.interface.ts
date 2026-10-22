export interface NotificationSr {
  id: number;
  type: string;
  titre: string;
  message: string;
  cible_type: string | null;
  cible_reference: string | null;
  lien: string | null;
  donnees: Record<string, unknown> | null;
  date_creation: string;
  lue: boolean;
}

export interface PageNotificationsSr {
  non_lues: number;
  notifications: NotificationSr[];
}

export interface FicheRecueSp {
  id: number;
  reference: string;
  createur: string;
  montant_total_programme: string;
  journee_tresorerie_reference: string | null;
  /** Date de création de la journée (liste de développement uniquement). */
  journee_date?: string;
}
