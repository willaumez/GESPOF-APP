import { API_CONFIG } from "@/shared/config/app";
import { lireJeton } from "@/shared/lib/auth-stockage";
import {
  ErreurApi,
  EVENEMENT_SESSION_EXPIREE,
  MESSAGE_SESSION_EXPIREE,
  requeteApi,
} from "@/shared/lib/api";
import { SERVICE_OPERATIONS_ENDPOINTS } from "./endpoints";
import type { LotImportSof } from "@/portails/Sof/types/imports.interface";

const BASE = SERVICE_OPERATIONS_ENDPOINTS.DC_REGLEMENTS_TVA;

export interface LigneDcMandat {
  id: number;
  type: string;
  dat_regl: string | null;
  n_emis: string | null;
  n_regl: string | null;
  d_emis: string | null;
  compte: string | null;
  nat: string | null;
  pc: string | null;
  mdr: string | null;
  matric: string | null;
  nom: string | null;
  m_regl: string | null;
  m_net: string | null;
  num_bv: string | null;
}

export interface AnomalieImportSof {
  id?: number;
  ligne: number;
  colonne: string | null;
  motif: string;
}

export interface VsPrecedent {
  pct: number;
  libelle: string;
  alerte: boolean;
}

export interface EtatDcReglementsTva {
  periode: {
    id: number;
    mois: number;
    exercice_annee: number;
    mois_libelle?: string;
  } | null;
  compte: string;
  nature: string;
  colonnes: string[];
  colonnes_attendues: string[];
  lot: LotImportSof | null;
  lignes: LigneDcMandat[];
  anomalies: AnomalieImportSof[];
  nombre: number;
  total: string;
  premiere_date: string | null;
  derniere_date: string | null;
  vs_precedent: VsPrecedent | null;
  page: number;
  page_size: number;
  pages: number;
  message: string | null;
}

export function obtenirEtatDcReglementsTva(params?: {
  periode_id?: number;
  page?: number;
  page_size?: number;
}): Promise<EtatDcReglementsTva> {
  const q = new URLSearchParams();
  if (params?.periode_id != null) q.set("periode_id", String(params.periode_id));
  if (params?.page != null) q.set("page", String(params.page));
  if (params?.page_size != null) q.set("page_size", String(params.page_size));
  const qs = q.toString();
  return requeteApi(`${BASE}${qs ? `?${qs}` : ""}`);
}

export function importerOracleDcReglementsTva(donnees: {
  date_debut: string;
  date_fin: string;
  periode_id?: number;
}): Promise<EtatDcReglementsTva & { nb_anomalies?: number }> {
  return requeteApi(`${BASE}/importer-oracle`, {
    method: "POST",
    body: JSON.stringify(donnees),
    timeoutMs: 180_000,
  });
}

export async function importerExcelDcReglementsTva(params: {
  fichier: File;
  periode_id: number;
  date_debut?: string;
  date_fin?: string;
}): Promise<EtatDcReglementsTva & { nb_anomalies?: number }> {
  const fd = new FormData();
  fd.append("fichier", params.fichier);
  fd.append("periode_id", String(params.periode_id));
  if (params.date_debut) fd.append("date_debut", params.date_debut);
  if (params.date_fin) fd.append("date_fin", params.date_fin);

  const token = lireJeton();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const controller = new AbortController();
  const minuterie = setTimeout(() => controller.abort(), 180_000);

  try {
    const reponse = await fetch(
      `${API_CONFIG.BASE_URL}${BASE}/importer-excel`,
      {
        method: "POST",
        headers,
        body: fd,
        signal: controller.signal,
      },
    );
    if (!reponse.ok) {
      if (reponse.status === 401 && token) {
        window.dispatchEvent(new Event(EVENEMENT_SESSION_EXPIREE));
        throw new ErreurApi(reponse.status, MESSAGE_SESSION_EXPIREE);
      }
      const corps = (await reponse.json().catch(() => ({}))) as Record<
        string,
        unknown
      >;
      throw new ErreurApi(
        reponse.status,
        reponse.status === 403
          ? "Vous n'avez pas les droits nécessaires pour cette action."
          : ((corps.message as string) ?? `Erreur HTTP ${reponse.status}`),
      );
    }
    return (await reponse.json()) as EtatDcReglementsTva & {
      nb_anomalies?: number;
    };
  } catch (erreur) {
    if (erreur instanceof ErreurApi) throw erreur;
    if (erreur instanceof DOMException && erreur.name === "AbortError") {
      throw new ErreurApi(408, "La requête a expiré. Réessayez.");
    }
    throw erreur;
  } finally {
    clearTimeout(minuterie);
  }
}
