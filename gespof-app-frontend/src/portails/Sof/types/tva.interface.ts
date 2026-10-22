import type { ExtractionOracleBase, LigneOperationDope } from "./depenses.interface";

export interface LigneRapTva {
  c_pc: string | null;
  l_pc: string | null;
  n_emis: string | null;
  d_emis: string | null;
  c_it: string | null;
  libelle_compte: string | null;
  c_typnat: string | null;
  c_nat: string | null;
  libelle_nature: string | null;
  c_mdr: string | null;
  n_mattir: string | null;
  nom: string | null;
  n_benc: string | null;
  rap: string;
  d_visa: string | null;
  objet: string | null;
  ref: string | null;
  c_blocag: string | null;
  l_blocag: string | null;
  orig: string | null;
}

export interface LigneRemboursementTvaDc {
  n_emis: string | null;
  n_regl: string | null;
  d_emis: string | null;
  c_it: string | null;
  c_nat: string | null;
  c_pc: string | null;
  libelle_compte: string | null;
  libelle_nature: string | null;
  l_pc: string | null;
  c_banque: string | null;
  c_mdr: string | null;
  n_cptb: string | null;
  n_mattir: string | null;
  nom: string | null;
  n_benc: string | null;
  m_regl: string;
  m_net: string;
  d_regl: string | null;
  n_bv: string | null;
  n_cbanq: string | null;
  l_ref1: string | null;
  l_ref2: string | null;
  l_ref3: string | null;
  l_ref4: string | null;
}

export type ExtractionRapTva = ExtractionOracleBase<LigneRapTva>;
export type ExtractionRemboursementsTvaDc = ExtractionOracleBase<LigneRemboursementTvaDc>;
export type ExtractionRemboursementsTvaIg = ExtractionOracleBase<LigneOperationDope>;
