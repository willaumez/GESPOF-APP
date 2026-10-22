import { requeteApi } from "@/shared/lib/api";
import { SERVICE_REGLEMENT_ENDPOINTS } from "./endpoints";
import type { FicheRecueSp } from "@/portails/Sr/types/notification.interface";
import type { FicheBleueDetail } from "@/portails/Sp/types/fiche-bleue.interface";

export function ficheRecuePourDate(
  date: string,
): Promise<{ date: string; fiche: FicheRecueSp | null }> {
  const query = new URLSearchParams({ date });
  return requeteApi<{ date: string; fiche: FicheRecueSp | null }>(
    `${SERVICE_REGLEMENT_ENDPOINTS.FICHE_RECUE}?${query.toString()}`,
  );
}

/** DEV uniquement : Fiches Bleues des journées récentes (404 hors env. dev). */
export function fichesRecuesRecentes(): Promise<{ fiches: FicheRecueSp[] }> {
  return requeteApi<{ fiches: FicheRecueSp[] }>(
    `${SERVICE_REGLEMENT_ENDPOINTS.FICHE_RECUE}/recentes`,
  );
}

export function detailFicheRecue(id: number): Promise<{ fiche: FicheBleueDetail }> {
  return requeteApi<{ fiche: FicheBleueDetail }>(
    `${SERVICE_REGLEMENT_ENDPOINTS.FICHE_RECUE}/${id}`,
  );
}
