import { SERVICE_OPERATIONS_ENDPOINTS } from "./endpoints";
import {
  creerClientImportExtraction,
  type EtatImportExtraction,
} from "./import-extraction";

/** Ligne IG VIDR (F1) — règlements TVA 4781-31 / nature 81. */
export interface LigneIgReglementTva {
  id: number;
  c_pca: string | null;
  d_cpta: string | null;
  n_regl: string | null;
  n_lig_r: string | null;
  c_typ_op: string | null;
  n_op: string | null;
  c_guic: string | null;
  n_mattir: string | null;
  l_np: string | null;
  c_ope: string | null;
  c_it: string | null;
  c_nat: string | null;
  c_ref1: string | null;
  c_ref2: string | null;
  m_regl: string | null;
  c_nop: string | null;
  c_mdr: string | null;
  n_cheq: string | null;
  c_cais: string | null;
  l_tiers: string | null;
}

export type EtatIgReglementsTva = EtatImportExtraction<LigneIgReglementTva>;

const client = creerClientImportExtraction<LigneIgReglementTva>(
  SERVICE_OPERATIONS_ENDPOINTS.IG_REGLEMENTS_TVA,
);

export const obtenirEtatIgReglementsTva = client.obtenirEtat;
export const importerOracleIgReglementsTva = client.importerOracle;
export const importerExcelIgReglementsTva = client.importerExcel;
