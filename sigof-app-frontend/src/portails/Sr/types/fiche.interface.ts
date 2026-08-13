export interface Stats {
  cree:       number;
  envoyee:    number;
  recue:      number;
  en_attente: number;
}

export interface Fiche {
  reference:      string;
  date_creation:  string;
  datePresentation: string;
  montant_total:  string;
  genere_par:     string;
  statut:         string;
  chemin_fichier: string | null;
  hash_fichier:   string | null;
}

export interface Pagination {
  page:        number;
  limit:       number;
  total:       number;
  total_pages: number;
}

export interface FichesDepotResponse {
  stats:      Stats;
  fiches:     Fiche[];
  pagination: Pagination;
}

export interface ObservationLigne {
  id:      number;
  contenu: string;
}

export interface LigneMouvement {
  id:             number;
  date_virement:  string | null;
  beneficiaire:   string;
  numero_ov:      string | null;
  banque:         string | null;
  depenses:       number;
  observations:   ObservationLigne[];
  montant_groupe?: number;
}

export interface DonneesMouvement {
  beneficiaire:                  string;
  depenses:                      number;
  date_virement?:                string | null;
  numero_ov?:                    string | null;
  banque?:                       string | null;
  observation_contenu?:          string | null;
  observation_lignes_associees?: number[];
}

export interface GenerateurFiche {
  id:          number;
  nom_complet: string;
  matricule:   string;
}

export interface LigneSystacDetail {
  id:             number;
  id_groupe:      number;
  c_orig:         string | null;
  d_presentation: string | null;
  l_orig:         string | null;
  n_bv:           string;
  nb_regl:        number;
  montant_systac: number;
  montant_groupe: number;
  designation:    string;
  d_creation_ip:  string | null;
  d_generation:   string | null;
}

export interface LigneFicheNonValidee {
  c_orig:         string | null;
  l_orig:         string | null;
  d_presentation: string | null;
  n_bv:           string;
  nb_regl:        number;
  montant_systac: number;
  montant_groupe: number;
  designation:    string;
}

export interface FicheNonValidee {
  valide:                false;
  statut:                "non_validee";
  message:                string;
  date:                  string;
  total_montant_systac:  number;
  total_montant_groupe:  number;
  lignes:                LigneFicheNonValidee[];
}

export interface FicheGenereeAvecSucces {
  valide:    true;
  statut:    string;
  date:      string;
  reference: string;
}

export type ResultatGenerationFiche = FicheGenereeAvecSucces | FicheNonValidee;

export interface FicheDepotDetail {
  reference:             string;
  statut:                string;
  date_creation:         string;
  date_presentation:     string;
  montant_total:         string;
  total_numeraire:       string;
  total_sigma:           string;
  total_systac:          string;
  total_groupe:          string;
  url_apercu:            string | null;
  url_telecharger:       string | null;
  hash_fichier:          string | null;
  genere_par:            GenerateurFiche;
  mouvements_numeraire:  LigneMouvement[];
  mouvements_sygma:      LigneMouvement[];
  mouvements_systac:     LigneMouvement[];
  lignes_systac:         LigneSystacDetail[];
}
