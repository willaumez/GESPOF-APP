import { SERVICE_OPERATIONS_ENDPOINTS } from "./endpoints";
import {
  creerClientImportExtraction,
  type EtatImportExtraction,
} from "./import-extraction";

export interface LigneDcReglementOrdonnance {
  id: number;
  type: string | null;
  type_1: string | null;
  categ: string | null;
  ex: string | null;
  dat_regl: string | null;
  ordonnance: string | null;
  n_regl: string | null;
  d_emis: string | null;
  min: string | null;
  l_min: string | null;
  mission: string | null;
  l_mis: string | null;
  prog: string | null;
  action: string | null;
  titre: string | null;
  bop: string | null;
  l_bop: string | null;
  uo: string | null;
  l_uo: string | null;
  pc: string | null;
  lib_pc: string | null;
  l_prog: string | null;
  nat: string | null;
  nature: string | null;
  banque: string | null;
  mdr: string | null;
  compte_banc: string | null;
  matric: string | null;
  nom: string | null;
  m_regl: string | null;
  m_net: string | null;
  m_prec_tva: string | null;
  n_mandat_tva: string | null;
  objet: string | null;
  num_bv: string | null;
  n_cbanq: string | null;
  d_eche: string | null;
}

export type EtatDcReglementsOrdonnances =
  EtatImportExtraction<LigneDcReglementOrdonnance>;

const client = creerClientImportExtraction<LigneDcReglementOrdonnance>(
  SERVICE_OPERATIONS_ENDPOINTS.DC_REGLEMENTS_ORDONNANCES,
);

export const obtenirEtatDcReglementsOrdonnances = client.obtenirEtat;
export const importerOracleDcReglementsOrdonnances = client.importerOracle;
export const importerExcelDcReglementsOrdonnances = client.importerExcel;
