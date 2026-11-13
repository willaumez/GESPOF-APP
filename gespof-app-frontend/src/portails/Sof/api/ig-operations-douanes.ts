import { requeteApi } from "@/shared/lib/api";
import { SERVICE_OPERATIONS_ENDPOINTS } from "./endpoints";
import type { LotImportSof } from "@/portails/Sof/types/imports.interface";
import type { LigneIgOperation } from "./ig-operations-petrole";

const BASE = SERVICE_OPERATIONS_ENDPOINTS.IG_OPERATIONS_DOUANES;

export interface LigneGrilleDouane {
  compte: string;
  libelle: string;
  type: string;
  type_libelle: string;
  montant: string;
  nb_lignes: number;
  operations: string;
  bancaire_seulement: boolean;
  lot: LotImportSof | null;
}

export interface RusidSynthese {
  compte: string;
  libelle: string;
  montant: string;
  sens: string;
  source: string | null;
}

export function listerGrilleDouanes(periodeId?: number): Promise<{
  periode: { id: number; mois: number; exercice_annee: number } | null;
  lignes: LigneGrilleDouane[];
  rusid: RusidSynthese | null;
  message: string | null;
}> {
  const q =
    periodeId != null
      ? `?periode_id=${encodeURIComponent(String(periodeId))}`
      : "";
  return requeteApi(`${BASE}${q}`);
}

export function obtenirCompteDouane(params: {
  compte: string;
  periode_id?: number;
}): Promise<{
  compte: string;
  libelle: string;
  lot: LotImportSof | null;
  lignes: LigneIgOperation[];
  nombre: number;
  total: string;
  message: string | null;
}> {
  const q = new URLSearchParams();
  q.set("compte", params.compte);
  if (params.periode_id != null) q.set("periode_id", String(params.periode_id));
  return requeteApi(`${BASE}/compte?${q}`);
}

export function importerOperationsIgDouanes(donnees: {
  date_debut: string;
  date_fin: string;
  periode_id?: number;
}): Promise<{
  comptes: Array<{
    compte: string;
    nb_lignes: number;
    montant_total: string;
  }>;
  rusid: RusidSynthese;
  message: string | null;
}> {
  return requeteApi(`${BASE}/importer`, {
    method: "POST",
    body: JSON.stringify(donnees),
  });
}
