import { requeteApi } from "@/shared/lib/api";
import { SERVICE_PREVISION_ENDPOINTS } from "./endpoints";
import type {
  FicheDepotDetailSp, FicheDepotResumeSp, PageFichesDepotSp,
} from "@/portails/Sp/types/fiche-depot.interface";

const BASE = SERVICE_PREVISION_ENDPOINTS.FICHES_DEPOT;

export interface ListerFichesDepotParams {
  page?: number;
  limite?: number | "all";
  q?: string;
  statut?: string;
  date_debut?: string;
  date_fin?: string;
}

export function listerFichesDepotDeJournee(
  journee: string,
): Promise<{ journee: string; fiches: FicheDepotResumeSp[] }> {
  const query = new URLSearchParams({ journee });
  return requeteApi<{ journee: string; fiches: FicheDepotResumeSp[] }>(
    `${BASE}?${query.toString()}`,
  );
}

export function listerFichesDepotDuJour(
  date: string,
): Promise<{ date: string; fiches: FicheDepotResumeSp[] }> {
  const query = new URLSearchParams({ date });
  return requeteApi<{ date: string; fiches: FicheDepotResumeSp[] }>(
    `${BASE}?${query.toString()}`,
  );
}

export function listerFichesDepot(
  params: ListerFichesDepotParams = {},
): Promise<PageFichesDepotSp> {
  const query = new URLSearchParams();
  if (params.page != null) query.set("page", String(params.page));
  if (params.limite != null) query.set("limite", String(params.limite));
  if (params.q) query.set("q", params.q);
  if (params.statut) query.set("statut", params.statut);
  if (params.date_debut) query.set("date_debut", params.date_debut);
  if (params.date_fin) query.set("date_fin", params.date_fin);
  const suffixe = query.toString() ? `?${query.toString()}` : "";
  return requeteApi<PageFichesDepotSp>(`${BASE}${suffixe}`);
}

export function detailFicheDepot(reference: string): Promise<FicheDepotDetailSp> {
  return requeteApi<FicheDepotDetailSp>(`${BASE}/${encodeURIComponent(reference)}`);
}

export function marquerFicheDepotRecue(reference: string): Promise<{
  reference: string;
  statut: string;
  journee_tresorerie_reference: string | null;
  lien: string;
}> {
  return requeteApi(
    `${BASE}/${encodeURIComponent(reference)}/reception`,
    { method: "POST" },
  );
}
