export interface Resume {
  fiche_du_jour: {
    existe:        boolean;
    date:          string;
    montant_total: string | null;
    statut:        string | null;
    reference:     string | null;
  };
  dernier_transmis: {
    montant_total: string;
    date:          string;
    reference:     string;
  } | null;
  en_attente_sp: { nombre: number };
}

export interface FicheRecente {
  reference:      string;
  date_creation:  string;
  datePresentation: string;
  montant_total:  string;
  genere_par:     string;
  statut:         string;
  chemin_fichier: string | null;
  fiche_recue?:   { id: number | null; reference: string } | null;
}
