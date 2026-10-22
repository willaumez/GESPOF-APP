export interface DateOuverture {
  date_ouverture: string | null;
  n_session: string | null;
  code: string | null;
  libelle: string | null;
}

export interface DatesOuverture {
  dates: DateOuverture[];
  message: string | null;
}

export interface RecetteBeac {
  origine: string;
  date_reception: string | null;
  date_validation: string | null;
  type_operation: string;
  montant: string;
  reference: string | null;
  num_reglement: string | null;
  libelle_tiers: string | null;
  delai_jours: string;
}

export interface RecettesBeac {
  date: string;
  operations: RecetteBeac[];
  total: string;
  nombre: number;
  page: number;
  pages: number;
  limite: number | "all";
  origines: string[];
  message: string | null;
}

export interface ListerRecettesBeacParams {
  date: string;
  q?: string;
  origine?: string;
  page?: number;
  limite?: number | "all";
}

export interface OperationBeac {
  origine: string;
  date_reception: string | null;
  date_validation: string | null;
  type_operation: string;
  montant: string;
  reference: string | null;
  num_reglement: string | null;
  libelle_tiers: string | null;
  statut: string;
  delai_jours: string;
}

export interface OperationsJour {
  date_ouverture: string | null;
  n_session: string | null;
  code: string | null;
  libelle: string | null;
  operations: OperationBeac[];
  total_recettes: string;
  total_depenses: string;
  message: string | null;
}
