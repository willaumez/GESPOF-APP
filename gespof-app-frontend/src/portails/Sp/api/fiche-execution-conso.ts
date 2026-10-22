import { requeteApi } from "@/shared/lib/api";
import { SERVICE_PREVISION_ENDPOINTS } from "./endpoints";
import type {
  MatriceFicheExecutionConso,
  VueConso,
} from "@/portails/Sp/types/fiche-execution-conso.interface";

export function chargerFicheExecutionConso(
  vue: VueConso,
  dateIso: string,
): Promise<MatriceFicheExecutionConso> {
  const params = new URLSearchParams({ vue, date: dateIso });
  return requeteApi<MatriceFicheExecutionConso>(
    `${SERVICE_PREVISION_ENDPOINTS.FICHE_EXECUTION_CONSO}?${params}`,
  );
}
