import { requeteApi } from "@/shared/lib/api";
import { SERVICE_PREVISION_ENDPOINTS } from "./endpoints";
import type {
  CreerFicheBleuePayload, FicheBleueDetail, ListerFichesBleuesParams, PageFichesBleues,
  ProgrammationFicheBleuePayload,
} from "@/portails/Sp/types/fiche-bleue.interface";

const BASE = SERVICE_PREVISION_ENDPOINTS.FICHES_BLEUES;

export function listerFichesBleues(
  params: ListerFichesBleuesParams = {},
): Promise<PageFichesBleues> {
  const query = new URLSearchParams();
  if (params.page) query.set("page", String(params.page));
  if (params.limite) query.set("limite", String(params.limite));
  if (params.date) query.set("date", params.date);
  if (params.q) query.set("q", params.q);
  if (params.statut) query.set("statut", params.statut);
  if (params.date_debut) query.set("date_debut", params.date_debut);
  if (params.date_fin) query.set("date_fin", params.date_fin);
  const suffixe = query.size > 0 ? `?${query.toString()}` : "";

  return requeteApi<PageFichesBleues>(`${BASE}${suffixe}`);
}

export function detailFicheBleue(id: number): Promise<{ fiche: FicheBleueDetail }> {
  return requeteApi<{ fiche: FicheBleueDetail }>(`${BASE}/${id}`);
}

export function creerFicheBleue(
  payload: CreerFicheBleuePayload,
): Promise<{ fiche: FicheBleueDetail }> {
  return requeteApi<{ fiche: FicheBleueDetail }>(BASE, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function modifierFicheBleue(
  id: number,
  payload: CreerFicheBleuePayload,
): Promise<{ fiche: FicheBleueDetail }> {
  return requeteApi<{ fiche: FicheBleueDetail }>(`${BASE}/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

/** Applique des montants sur les feuilles ; le backend recalcule parents et totaux. */
export function appliquerMontantsProgramme(
  id: number,
  montants: { section_id: number; montant_programme: string }[],
): Promise<{ fiche: FicheBleueDetail }> {
  return requeteApi<{ fiche: FicheBleueDetail }>(`${BASE}/${id}/montants-programme`, {
    method: "PATCH",
    body: JSON.stringify({ montants }),
  });
}

export function programmerFicheBleue(
  id: number,
  payload: ProgrammationFicheBleuePayload,
): Promise<{ fiche: FicheBleueDetail }> {
  return requeteApi<{ fiche: FicheBleueDetail }>(`${BASE}/${id}/programmation`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}
