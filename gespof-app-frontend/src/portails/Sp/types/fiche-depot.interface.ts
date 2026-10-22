export type StatutFicheDepotSp = "envoyee" | "recue" | "cree" | string;

export interface FicheDepotResumeSp {
  reference: string;
  date_creation: string;
  date_presentation: string;
  date_presentation_libelle: string;
  date_presentation_iso?: string;
  montant_total: string;
  genere_par: string;
  statut: StatutFicheDepotSp;
  hash_fichier: string | null;
  url_apercu: string | null;
  url_telecharger: string | null;
  journee_tresorerie_reference: string | null;
}

export interface PageFichesDepotSp {
  fiches: FicheDepotResumeSp[];
  total: number;
  page: number;
  pages: number;
  limite: number | "all";
}

export interface ObservationLigneSp {
  id: number;
  contenu: string;
}

export interface LigneMouvementSp {
  id: number;
  date_virement: string | null;
  beneficiaire: string;
  numero_ov: string | null;
  banque: string | null;
  depenses: number;
  observations: ObservationLigneSp[];
  designation?: string | null;
  montant_systac?: number;
  montant_groupe?: number;
}

export interface FicheDepotDetailSp {
  reference: string;
  statut: string;
  date_creation: string;
  date_presentation: string;
  montant_total: string;
  total_numeraire: string;
  total_sigma: string;
  total_systac: string;
  total_groupe: string;
  url_apercu: string | null;
  url_telecharger: string | null;
  hash_fichier: string | null;
  genere_par: { id: number; nom_complet: string; matricule: string };
  journee_tresorerie_reference: string | null;
  mouvements_numeraire: LigneMouvementSp[];
  mouvements_sygma: LigneMouvementSp[];
  mouvements_systac: LigneMouvementSp[];
}
