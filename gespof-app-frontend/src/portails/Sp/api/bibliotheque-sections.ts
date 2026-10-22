import { requeteApi } from "@/shared/lib/api";
import { SERVICE_PREVISION_ENDPOINTS } from "./endpoints";
import type {
  DeplacementSectionPayload, PageBibliotheque, SectionBibliotheque, SectionBibliothequePayload,
  TypeSectionBibliotheque,
} from "@/portails/Sp/types/bibliotheque.interface";

const BASE = SERVICE_PREVISION_ENDPOINTS.BIBLIOTHEQUE_SECTIONS;

/**
 * Arbre paginé de la bibliothèque : `q` filtre par libellé (sections et
 * sous-sections), `type` filtre les racines, `page` / `limite` paginent.
 */
export function listerBibliothequeSections(
  params: {
    q?: string;
    type?: TypeSectionBibliotheque;
    page?: number;
    limite?: number;
  } = {},
): Promise<PageBibliotheque> {
  const query = new URLSearchParams();
  if (params.q) query.set("q", params.q);
  if (params.type) query.set("type", params.type);
  if (params.page) query.set("page", String(params.page));
  if (params.limite) query.set("limite", String(params.limite));
  const suffixe = query.size > 0 ? `?${query.toString()}` : "";

  return requeteApi<PageBibliotheque>(`${BASE}${suffixe}`);
}

/** Une section avec toute son arborescence (dialogs Détail / Modifier). */
export function detailSectionBibliotheque(id: number): Promise<{ section: SectionBibliotheque }> {
  return requeteApi<{ section: SectionBibliotheque }>(`${BASE}/${id}`);
}

export function creerSectionBibliotheque(
  payload: SectionBibliothequePayload,
): Promise<{ section: SectionBibliotheque }> {
  return requeteApi<{ section: SectionBibliotheque }>(BASE, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function modifierSectionBibliotheque(
  id: number,
  payload: { libelle?: string; type?: TypeSectionBibliotheque },
): Promise<{ section: SectionBibliotheque }> {
  return requeteApi<{ section: SectionBibliotheque }>(`${BASE}/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

/** Le backend renvoie l'arbre complet mis à jour après le déplacement. */
export function deplacerSectionBibliotheque(
  id: number,
  payload: DeplacementSectionPayload,
): Promise<{ sections: SectionBibliotheque[] }> {
  return requeteApi<{ sections: SectionBibliotheque[] }>(`${BASE}/${id}/deplacer`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

/** Réservé au chef SP côté backend (#[IsGranted('ROLE_CHEF_SP')]). */
export function supprimerSectionBibliotheque(id: number): Promise<{ ok: true }> {
  return requeteApi<{ ok: true }>(`${BASE}/${id}`, { method: "DELETE" });
}
