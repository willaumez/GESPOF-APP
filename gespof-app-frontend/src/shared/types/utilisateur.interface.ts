export interface RoleInfo {
  valeur: string;
  libelle: string;
}

export type GenreUtilisateur = "homme" | "femme" | null;

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
  /** Accès autorisés pour CE compte (colonne `utilisateur.acces`) — c'est la liste qui fait foi. */
  acces: RoleInfo[];
  /** Catalogue des accès que le métier de ce compte accorde par défaut, en lecture seule. */
  acces_catalogue: RoleInfo[];
  actif: boolean;
  connection: string;
  date_creation: string;
  derniere_connexion: string | null;
  genre: GenreUtilisateur;
  civilite: string | null;
  a_photo: boolean;
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
