import { requeteApi } from "@/shared/lib/api";
import { SERVICE_PREVISION_ENDPOINTS } from "./endpoints";
import type {
  MaquetteDetail, MaquettePayload, MaquetteResume, SectionMaquette,
} from "@/portails/Sp/types/maquette.interface";

const BASE = SERVICE_PREVISION_ENDPOINTS.MAQUETTES;

export function listerMaquettes(recherche?: string): Promise<{ maquettes: MaquetteResume[] }> {
  const query = recherche ? `?q=${encodeURIComponent(recherche)}` : "";
  return requeteApi<{ maquettes: MaquetteResume[] }>(`${BASE}${query}`);
}

export function detailMaquette(id: number): Promise<{ maquette: MaquetteDetail }> {
  return requeteApi<{ maquette: MaquetteDetail }>(`${BASE}/${id}`);
}

/** Sections racines deja connues, reutilisables dans n'importe quelle maquette. */
export function listerCatalogueSections(): Promise<{ sections: SectionMaquette[] }> {
  return requeteApi<{ sections: SectionMaquette[] }>(
    SERVICE_PREVISION_ENDPOINTS.MAQUETTES_CATALOGUE_SECTIONS,
  );
}

export function creerMaquette(payload: MaquettePayload): Promise<{ maquette: MaquetteDetail }> {
  return requeteApi<{ maquette: MaquetteDetail }>(BASE, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/** Le backend accepte un payload partiel : seuls les champs presents sont modifies. */
export function modifierMaquette(
  id: number,
  payload: Partial<MaquettePayload>,
): Promise<{ maquette: MaquetteDetail }> {
  return requeteApi<{ maquette: MaquetteDetail }>(`${BASE}/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

/** Reserve au chef SP cote backend (#[IsGranted('ROLE_CHEF_SP')]). */
export function supprimerMaquette(id: number): Promise<{ ok: true }> {
  return requeteApi<{ ok: true }>(`${BASE}/${id}`, { method: "DELETE" });
}
