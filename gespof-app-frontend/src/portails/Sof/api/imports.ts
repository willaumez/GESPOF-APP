import { requeteApi } from "@/shared/lib/api";
import { SERVICE_OPERATIONS_ENDPOINTS } from "./endpoints";
import type {
  AnomalieImportSof,
  ComparaisonLotsSof,
  LotImportSof,
  StatutLotImport,
} from "@/portails/Sof/types/imports.interface";

export function listerLotsImport(filtres?: {
  periode_id?: number;
  statut?: StatutLotImport | "tous";
}): Promise<{ lots: LotImportSof[] }> {
  const params = new URLSearchParams();
  if (filtres?.periode_id != null) {
    params.set("periode_id", String(filtres.periode_id));
  }
  if (filtres?.statut && filtres.statut !== "tous") {
    params.set("statut", filtres.statut);
  }
  const q = params.toString();
  return requeteApi(
    `${SERVICE_OPERATIONS_ENDPOINTS.LOTS_IMPORT}${q ? `?${q}` : ""}`,
  );
}

export function obtenirLotImport(
  id: number,
): Promise<{ lot: LotImportSof & { anomalies?: AnomalieImportSof[] } }> {
  return requeteApi(`${SERVICE_OPERATIONS_ENDPOINTS.LOTS_IMPORT}/${id}`);
}

export function listerAnomaliesLot(
  lotId: number,
): Promise<{ anomalies: AnomalieImportSof[] }> {
  return requeteApi(
    `${SERVICE_OPERATIONS_ENDPOINTS.LOTS_IMPORT}/${lotId}/anomalies`,
  );
}

export function annulerLotImport(
  id: number,
  motif: string,
): Promise<{ lot: LotImportSof }> {
  return requeteApi(`${SERVICE_OPERATIONS_ENDPOINTS.LOTS_IMPORT}/${id}/annuler`, {
    method: "POST",
    body: JSON.stringify({ motif }),
  });
}

export function comparerLotsImport(
  lotIds: [number, number],
): Promise<{ comparaison: ComparaisonLotsSof }> {
  return requeteApi(`${SERVICE_OPERATIONS_ENDPOINTS.LOTS_IMPORT}/comparer`, {
    method: "POST",
    body: JSON.stringify({ lot_ids: lotIds }),
  });
}
