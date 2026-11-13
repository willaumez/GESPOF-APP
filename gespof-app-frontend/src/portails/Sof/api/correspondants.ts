import { requeteApi } from "@/shared/lib/api";
import { SERVICE_OPERATIONS_ENDPOINTS } from "./endpoints";
import {
  envoyerFormulaire,
  type AnomalieImportSof,
  type PeriodeImportSof,
} from "./import-extraction";
import type { LotImportSof } from "@/portails/Sof/types/imports.interface";

export type SensCorrespondant = "DEPENSE" | "RECETTE";

/** Ligne de la grille corr (catégorie · compte · libellé · M01…M12). */
export interface LigneGrilleCorrespondant {
  categorie: string | null;
  compte: string | null;
  libelle: string | null;
  /** 12 montants FCFA (janvier → décembre). */
  mois: string[];
  total: string;
}

export interface OngletCorrespondants {
  sens: SensCorrespondant;
  lot: LotImportSof | null;
  lignes: LigneGrilleCorrespondant[];
  anomalies: AnomalieImportSof[];
  nombre: number;
  total: string;
}

export interface EtatCorrespondantsImport {
  periode: PeriodeImportSof | null;
  source: string;
  format: string;
  colonnes: string[];
  unite_import?: string;
  onglets: Partial<Record<SensCorrespondant, OngletCorrespondants>>;
  imports?: Record<
    string,
    {
      lot_id: number;
      nb_lignes: number;
      montant_total: string;
      nb_anomalies: number;
    }
  >;
  message: string | null;
}

export function obtenirEtatCorrespondants(params?: {
  periode_id?: number;
  sens?: SensCorrespondant;
}): Promise<EtatCorrespondantsImport> {
  const q = new URLSearchParams();
  if (params?.periode_id != null) q.set("periode_id", String(params.periode_id));
  if (params?.sens) q.set("sens", params.sens);
  const qs = q.toString();
  return requeteApi(
    `${SERVICE_OPERATIONS_ENDPOINTS.SERVICE_CORRESPONDANTS}${qs ? `?${qs}` : ""}`,
  );
}

export function importerExcelCorrespondants(params: {
  fichier: File;
  periode_id: number;
  sens?: SensCorrespondant;
}): Promise<EtatCorrespondantsImport> {
  const fd = new FormData();
  fd.append("fichier", params.fichier);
  fd.append("periode_id", String(params.periode_id));
  if (params.sens) fd.append("sens", params.sens);
  return envoyerFormulaire(
    `${SERVICE_OPERATIONS_ENDPOINTS.SERVICE_CORRESPONDANTS}/importer-excel`,
    fd,
  );
}

/** Recettes › Correspondants — une ligne = compte fléché. */
export interface LigneRecettesCorrespondants {
  categorie: string;
  compte: string | null;
  libelle: string | null;
  rubrique_code: string | null;
  /** 12 montants FCFA. */
  mois: string[];
  montant_mois: string;
  cumul: string;
  total_annee: string;
}

export interface RecettesCorrespondantsPage {
  periode: PeriodeImportSof | null;
  lot: LotImportSof | null;
  lignes: LigneRecettesCorrespondants[];
  /** Liste des catégories présentes (filtre). */
  categories: string[];
  total_mois: string;
  total_cumul: string;
  total_annee: string;
  message: string | null;
}

export function obtenirRecettesCorrespondants(params?: {
  periode_id?: number;
  categorie?: string;
}): Promise<RecettesCorrespondantsPage> {
  const q = new URLSearchParams();
  if (params?.periode_id != null) q.set("periode_id", String(params.periode_id));
  if (params?.categorie) q.set("categorie", params.categorie);
  const qs = q.toString();
  return requeteApi(
    `${SERVICE_OPERATIONS_ENDPOINTS.RECETTES_CORRESPONDANTS}${qs ? `?${qs}` : ""}`,
  );
}

export function recalculerRecettesCorrespondants(params?: {
  periode_id?: number;
}): Promise<{
  nb_lignes_flechees: number;
  cumul: { exercice: number; nb_cellules: number; nb_codes: number; total: string };
  etat: RecettesCorrespondantsPage;
}> {
  return requeteApi(`${SERVICE_OPERATIONS_ENDPOINTS.RECETTES_CORRESPONDANTS}/recalculer`, {
    method: "POST",
    body: JSON.stringify({ periode_id: params?.periode_id ?? null }),
  });
}
