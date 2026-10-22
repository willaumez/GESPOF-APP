export type StatutRecetteDashboard = "valide" | "partiel" | "manuel" | "en_attente";
export type StatutDepenseDashboard = "payee" | "partielle" | "urgence" | "en_attente";
export type SourceTableauDashboard = "fiche_execution" | "fiche_bleue";

export interface JourneeDashboard {
  reference: string;
  date: string;
  etat: string;
  etat_libelle: string;
  date_derniere_mise_a_jour: string;
  fiche_bleue_reference: string | null;
  fiche_execution_reference: string | null;
}

export interface IndicateursDashboard {
  solde_ouverture: string;
  total_recettes: string;
  total_depenses: string;
  solde_cloture: string;
  solde_cloture_estime: boolean;
  variation_ouverture_pct: string | null;
  depenses_en_attente: string;
  nombre_postes_recettes: number;
  source_recettes: SourceTableauDashboard | null;
  source_depenses: SourceTableauDashboard | null;
}

export interface LigneRecetteDashboard {
  libelle: string;
  montant: string;
  montant_programme: string;
  statut: StatutRecetteDashboard;
  statut_libelle: string;
}

export interface LigneDepenseDashboard {
  libelle: string;
  programme: string | null;
  realise: string;
  statut: StatutDepenseDashboard;
  statut_libelle: string;
  hors_programme: boolean;
}

export interface ResumeDashboard {
  fiche_bleue: {
    reference: string | null;
    nombre_depenses: number;
    montant_programme: string;
  };
  fiches_depot: {
    nombre: number;
    montant_total: string;
  };
  ecarts: {
    nombre_hors_programme: number;
    montant_ecart: string;
  };
  archivage: {
    cloturee: boolean;
    date: string | null;
  };
}

export interface TableauBordSp {
  journee: JourneeDashboard | null;
  indicateurs: IndicateursDashboard;
  recettes: LigneRecetteDashboard[];
  depenses: LigneDepenseDashboard[];
  totaux: {
    recettes: string;
    depenses_programme: string;
    depenses_realise: string;
  };
  resume: ResumeDashboard;
}
