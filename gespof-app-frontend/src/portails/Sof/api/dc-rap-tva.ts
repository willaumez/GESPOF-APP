import { SERVICE_OPERATIONS_ENDPOINTS } from "./endpoints";
import {
  creerClientImportExtraction,
  type EtatImportExtraction,
} from "./import-extraction";

/** Ligne RAP TVA (F5 · XRAM) — mêmes champs que les mandats DC + colonnes RAP. */
export interface LigneDcRapTva {
  id: number;
  type: string;
  n_emis: string | null;
  d_emis: string | null;
  pc: string | null;
  mdr: string | null;
  matric: string | null;
  nom: string | null;
  mandat: string | null;
  rap: string | null;
  d_visa: string | null;
  objet: string | null;
  c_blocag: string | null;
}

export type EtatDcRapTva = EtatImportExtraction<LigneDcRapTva>;

const client = creerClientImportExtraction<LigneDcRapTva>(
  SERVICE_OPERATIONS_ENDPOINTS.DC_RAP_TVA,
);

export const obtenirEtatDcRapTva = client.obtenirEtat;
export const importerOracleDcRapTva = client.importerOracle;
export const importerExcelDcRapTva = client.importerExcel;
