import { SERVICE_OPERATIONS_ENDPOINTS } from "./endpoints";
import {
  creerClientImportExtraction,
  type EtatImportExtraction,
} from "./import-extraction";
import type { LigneIgOperationVidr } from "@/portails/Sof/components/imports/ig-vidr";

/** Ligne IG VIDR (F1) — crédits délégués 4742-*. */
export type LigneIgCreditDelegue = LigneIgOperationVidr;

export type EtatIgCreditsDelegues = EtatImportExtraction<LigneIgCreditDelegue>;

const client = creerClientImportExtraction<LigneIgCreditDelegue>(
  SERVICE_OPERATIONS_ENDPOINTS.IG_CREDITS_DELEGUES,
);

export const obtenirEtatIgCreditsDelegues = client.obtenirEtat;
export const importerOracleIgCreditsDelegues = client.importerOracle;
export const importerExcelIgCreditsDelegues = client.importerExcel;
