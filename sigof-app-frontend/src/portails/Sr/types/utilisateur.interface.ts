export interface RoleInfo {
  valeur:  string;
  libelle: string;
}

export interface UtilisateurSR {
  id:                 number;
  matricule:          string;
  email:              string;
  nom:                string;
  prenom:             string;
  roles:              RoleInfo[];
  actif:              boolean;
  connection:         string;
  date_creation:      string;
  derniere_connexion: string | null;
}

export interface UtilisateurCree extends UtilisateurSR {
  mot_de_passe_temporaire?: string;
}

export interface PaginationUtilisateurs {
  page:        number;
  limit:       number;
  total:       number;
  total_pages: number;
}

export interface UtilisateursSRResponse {
  utilisateurs: UtilisateurSR[];
  pagination:   PaginationUtilisateurs;
}

export type RoleSR = "AGENT_SR" | "CHEF_SR";
