/** Ligne opération DOPE/REGL (avances, crédits délégués, TVA-IG). */
export interface LigneOperationDope {
  c_pca: string | null;
  n_op: string | null;
  c_guic: string | null;
  n_mattir: string | null;
  c_mattir: string | null;
  l_np: string | null;
  n_lig_op: string | null;
  c_ope: string | null;
  c_it: string | null;
  c_nat: string | null;
  c_ref1: string | null;
  c_ref2: string | null;
  m_oper: string;
  n_regl: string | null;
  n_lig_r: string | null;
  m_regl: string;
  c_nop: string | null;
  c_mdr: string | null;
  n_cheq: string | null;
  d_cpta: string | null;
  c_cais: string | null;
}

export interface LigneReglementExercice {
  n_ordo: string | null;
  n_regl: string | null;
  d_emis: string | null;
  d_regl: string | null;
  matricule: string | null;
  nom_beneficiaire: string | null;
  c_mdr: string | null;
  objet: string | null;
  titr: string | null;
  pc: string | null;
  categ: string | null;
  montant_regle: string;
  montant_net: string;
}

export interface LigneEtatLiquidation {
  c_dev: string | null;
  l_dev: string | null;
  d_dev: string | null;
  d_valeur: string | null;
  nombre: string | null;
  m_brut: string;
  m_net: string;
  d_valid: string | null;
}

export interface ExtractionOracleBase<T> {
  date_debut: string;
  date_fin: string;
  etape: string;
  etape_libelle: string;
  lignes: T[];
  nombre: number;
  total: string;
  message: string | null;
}

export type ExtractionOperationsDope = ExtractionOracleBase<LigneOperationDope>;
export type ExtractionReglements = ExtractionOracleBase<LigneReglementExercice>;
export type ExtractionEtatsLiquidation = ExtractionOracleBase<LigneEtatLiquidation>;
