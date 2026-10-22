import { requeteApi } from "@/shared/lib/api";
import { SERVICE_PREVISION_ENDPOINTS } from "./endpoints";
import type {
  DatesOuverture,
  ListerRecettesBeacParams,
  RecettesBeac,
} from "@/portails/Sp/types/operations-jour.interface";

const BASE = SERVICE_PREVISION_ENDPOINTS.OPERATIONS_BEAC;

export function listerDatesOuvertureBeac(): Promise<DatesOuverture> {
  return requeteApi<DatesOuverture>(`${BASE}/dates-ouverture`);
}

export function listerRecettesBeac(params: ListerRecettesBeacParams): Promise<RecettesBeac> {
  const query = new URLSearchParams({ date: params.date });
  if (params.q) query.set("q", params.q);
  if (params.origine) query.set("origine", params.origine);
  if (params.page != null) query.set("page", String(params.page));
  if (params.limite != null) query.set("limite", String(params.limite));
  return requeteApi<RecettesBeac>(`${BASE}/recettes?${query.toString()}`);
}
