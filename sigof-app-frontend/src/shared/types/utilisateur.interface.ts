export interface RoleInfo {
  valeur: string;
  libelle: string;
}

export interface Utilisateur {
  id: number;
  matricule: string;
  email: string;
  nom: string;
  prenom: string;
  roles: RoleInfo[];
  /** Derives automatiquement du/des metier(s) cote backend, en lecture seule. */
  portails: string[];
  /** Derivees automatiquement du/des metier(s) cote backend, en lecture seule. */
  actions_autorisees: string[];
  actif: boolean;
  connection: string;
  date_creation: string;
  derniere_connexion: string | null;
}

export interface UtilisateurCree extends Utilisateur {
  mot_de_passe_temporaire?: string;
}

export interface PaginationUtilisateurs {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}

export interface UtilisateursResponse {
  utilisateurs: Utilisateur[];
  pagination: PaginationUtilisateurs;
}
