export interface HistoriqueUtilisateur {
  id:          number;
  nom_complet: string;
  matricule:   string;
}

export interface HistoriqueEntree {
  id:              number;
  action:          string;
  commentaire:     string | null;
  date_action:     string;
  ancien_statut:   string | null;
  nouveau_statut:  string | null;
  fiche_reference: string | null;
  utilisateur:     HistoriqueUtilisateur;
}

export interface PaginationHistorique {
  page:        number;
  limit:       number;
  total:       number;
  total_pages: number;
}

export interface HistoriqueResponse {
  historique: HistoriqueEntree[];
  pagination: PaginationHistorique;
}
