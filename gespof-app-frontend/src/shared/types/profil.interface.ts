export interface RoleProfil {
  valeur: string;
  libelle: string;
}

export type GenreProfil = "homme" | "femme" | null;

export interface UtilisateurProfil {
  id: number;
  matricule: string;
  email: string;
  nom: string;
  prenom: string;
  roles: RoleProfil[];
  actif: boolean;
  connection: string;
  date_creation: string;
  derniere_connexion: string | null;
  genre: GenreProfil;
  civilite: string | null;
  a_photo: boolean;
  /** Présent après PUT /auth/me (e-mail peut avoir changé). */
  token?: string;
}
