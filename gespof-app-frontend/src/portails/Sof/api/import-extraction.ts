import { API_CONFIG } from "@/shared/config/app";
import { lireJeton } from "@/shared/lib/auth-stockage";
import {
  ErreurApi,
  EVENEMENT_SESSION_EXPIREE,
  MESSAGE_SESSION_EXPIREE,
  requeteApi,
} from "@/shared/lib/api";
import type { LotImportSof } from "@/portails/Sof/types/imports.interface";

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

export interface PeriodeImportSof {
  id: number;
  mois: number;
  exercice_annee: number;
  mois_libelle?: string;
}

/** Réponse commune des imports « extraction » (DC / IG) paginés. */
export interface EtatImportExtraction<TLigne> {
  periode: PeriodeImportSof | null;
  compte: string;
  nature: string;
  colonnes: string[];
  colonnes_attendues?: string[];
  lot: LotImportSof | null;
  lignes: TLigne[];
  anomalies: AnomalieImportSof[];
  nombre: number;
  total: string;
  premiere_date: string | null;
  derniere_date: string | null;
  vs_precedent?: VsPrecedent | null;
  page: number;
  page_size: number;
  pages: number;
  message: string | null;
}

export type ResultatImportExtraction<TLigne> = EtatImportExtraction<TLigne> & {
  nb_anomalies?: number;
};

/**
 * POST multipart (fichier Excel) vers l'API — mutualisé pour les imports.
 */
export async function envoyerFormulaire<T>(
  chemin: string,
  fd: FormData,
  timeoutMs = 180_000,
): Promise<T> {
  const token = lireJeton();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const controller = new AbortController();
  const minuterie = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const reponse = await fetch(`${API_CONFIG.BASE_URL}${chemin}`, {
      method: "POST",
      headers,
      body: fd,
      signal: controller.signal,
    });
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
    return (await reponse.json()) as T;
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

export interface ClientImportExtraction<TLigne> {
  obtenirEtat(params?: {
    periode_id?: number;
    page?: number;
    page_size?: number;
  }): Promise<EtatImportExtraction<TLigne>>;
  importerOracle(donnees: {
    date_debut: string;
    date_fin: string;
    periode_id?: number;
  }): Promise<ResultatImportExtraction<TLigne>>;
  importerExcel(params: {
    fichier: File;
    periode_id: number;
    date_debut?: string;
    date_fin?: string;
  }): Promise<ResultatImportExtraction<TLigne>>;
}

/** Fabrique un client pour un endpoint `…/{GET, importer-oracle, importer-excel}`. */
export function creerClientImportExtraction<TLigne>(
  base: string,
): ClientImportExtraction<TLigne> {
  return {
    obtenirEtat(params) {
      const q = new URLSearchParams();
      if (params?.periode_id != null)
        q.set("periode_id", String(params.periode_id));
      if (params?.page != null) q.set("page", String(params.page));
      if (params?.page_size != null)
        q.set("page_size", String(params.page_size));
      const qs = q.toString();
      return requeteApi(`${base}${qs ? `?${qs}` : ""}`);
    },
    importerOracle(donnees) {
      return requeteApi(`${base}/importer-oracle`, {
        method: "POST",
        body: JSON.stringify(donnees),
        timeoutMs: 180_000,
      });
    },
    importerExcel(params) {
      const fd = new FormData();
      fd.append("fichier", params.fichier);
      fd.append("periode_id", String(params.periode_id));
      if (params.date_debut) fd.append("date_debut", params.date_debut);
      if (params.date_fin) fd.append("date_fin", params.date_fin);
      return envoyerFormulaire(`${base}/importer-excel`, fd);
    },
  };
}
