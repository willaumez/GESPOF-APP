export interface RoleProfil {
  valeur: string;
  libelle: string;
}

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
}
