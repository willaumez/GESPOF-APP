import { SERVICE_OPERATIONS_ENDPOINTS } from "./endpoints";
import {
  envoyerFormulaire,
  type AnomalieImportSof,
  type PeriodeImportSof,
} from "./import-extraction";
import type { LotImportSof } from "@/portails/Sof/types/imports.interface";
import type { LigneIgOperationVidr } from "@/portails/Sof/components/imports/ig-vidr";
import { requeteApi } from "@/shared/lib/api";

const BASE = SERVICE_OPERATIONS_ENDPOINTS.IG_AVANCES_BUDGET;

export type CompteAvanceBudget = "4701-5" | "4706-1";

export interface ResumeCompteAvanceBudget {
  compte: CompteAvanceBudget;
  prefixe: string;
  code: string;
  label: string;
  source: string;
  lot: LotImportSof | null;
  nombre: number;
  total: string;
  premiere_date: string | null;
  derniere_date: string | null;
  nb_anomalies: number;
}

export interface EtatIgAvancesBudget {
  periode: PeriodeImportSof | null;
  source: string;
  format: string;
  compte: CompteAvanceBudget;
  nature: string;
  compte_actif: CompteAvanceBudget;
  colonnes: string[];
  comptes: ResumeCompteAvanceBudget[];
  lot: LotImportSof | null;
  lignes: LigneIgOperationVidr[];
  anomalies: AnomalieImportSof[];
  nombre: number;
  total: string;
  premiere_date: string | null;
  derniere_date: string | null;
  page: number;
  page_size: number;
  pages: number;
  message: string | null;
  nb_anomalies?: number;
}

export function obtenirEtatIgAvancesBudget(params?: {
  compte?: CompteAvanceBudget;
  periode_id?: number;
  page?: number;
  page_size?: number;
}): Promise<EtatIgAvancesBudget> {
  const q = new URLSearchParams();
  q.set("compte", params?.compte ?? "4701-5");
  if (params?.periode_id != null) q.set("periode_id", String(params.periode_id));
  if (params?.page != null) q.set("page", String(params.page));
  if (params?.page_size != null) q.set("page_size", String(params.page_size));
  return requeteApi(`${BASE}?${q.toString()}`);
}

export function importerOracleIgAvancesBudget(donnees: {
  compte: CompteAvanceBudget;
  date_debut: string;
  date_fin: string;
  periode_id?: number;
}): Promise<EtatIgAvancesBudget> {
  return requeteApi(`${BASE}/importer-oracle`, {
    method: "POST",
    body: JSON.stringify(donnees),
    timeoutMs: 180_000,
  });
}

export function importerExcelIgAvancesBudget(params: {
  compte: CompteAvanceBudget;
  fichier: File;
  periode_id: number;
  date_debut?: string;
  date_fin?: string;
}): Promise<EtatIgAvancesBudget> {
  const fd = new FormData();
  fd.append("compte", params.compte);
  fd.append("fichier", params.fichier);
  fd.append("periode_id", String(params.periode_id));
  if (params.date_debut) fd.append("date_debut", params.date_debut);
  if (params.date_fin) fd.append("date_fin", params.date_fin);
  return envoyerFormulaire(`${BASE}/importer-excel`, fd);
}
