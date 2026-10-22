export type StatutSessionConnexion = "EN_LIGNE" | "DECONNECTE";

export interface SessionConnexionUtilisateur {
  id: number | null;
  matricule: string;
  nom: string;
  prenom: string;
  nom_complet: string;
  email: string;
}

export interface SessionConnexion {
  id: number;
  utilisateur: SessionConnexionUtilisateur;
  role: { valeur: string; libelle: string };
  portail: { valeur: string; libelle: string } | null;
  date_connexion: string;
  heure_connexion: string;
  date_deconnexion: string | null;
  heure_deconnexion: string | null;
  duree_secondes: number;
  duree: string;
  statut: StatutSessionConnexion;
  motif_deconnexion: { valeur: string; libelle: string } | null;
  adresse_ip: string | null;
}

export interface AuditConnexionsResume {
  utilisateurs_connectes: number;
  sessions_actives: number;
  connexions_aujourdhui: number;
}

export interface AuditConnexionsPointSerie {
  date: string;
  connexions: number;
  deconnexions: number;
}

export interface AuditConnexionsUtilisateurSerie {
  matricule: string;
  nom: string;
  prenom: string;
  nom_complet: string;
  email: string;
  connexions_7j: number;
  connexions_30j: number;
  connexions_90j: number;
  en_ligne: boolean;
}

export interface AuditRepartitionPart {
  cle: string;
  libelle: string;
  n_7j: number;
  n_30j: number;
  n_90j: number;
}

export interface AuditRepartitions {
  par_service: AuditRepartitionPart[];
  par_metier: AuditRepartitionPart[];
  par_motif: AuditRepartitionPart[];
  par_jour_semaine: AuditRepartitionPart[];
}

export interface AuditConnexionsResponse {
  sessions: SessionConnexion[];
  en_ligne: SessionConnexion[];
  resume: AuditConnexionsResume;
  serie: AuditConnexionsPointSerie[];
  par_utilisateur: AuditConnexionsUtilisateurSerie[];
  repartitions: AuditRepartitions;
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}
