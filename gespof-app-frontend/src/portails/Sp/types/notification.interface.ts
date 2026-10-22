export interface NotificationSp {
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

export interface PageNotificationsSp {
  non_lues: number;
  notifications: NotificationSp[];
}
