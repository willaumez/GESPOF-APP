export interface AuditActionUtilisateur {
  id: number | null;
  matricule: string;
  nom: string;
  prenom: string;
  nom_complet: string;
  email: string;
  a_photo?: boolean;
}

export interface AuditAction {
  id: number;
  utilisateur: AuditActionUtilisateur;
  role: { valeur: string; libelle: string };
  portail: { valeur: string; libelle: string } | null;
  module: string;
  methode: string;
  chemin: string;
  action: string;
  corps: Record<string, unknown> | null;
  code_http: number;
  adresse_ip: string | null;
  date_action: string;
  heure_action: string;
}

export interface AuditActionsResponse {
  actions: AuditAction[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}
