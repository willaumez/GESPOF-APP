import { requeteApi } from "@/shared/lib/api";
import { SERVICE_PREVISION_ENDPOINTS } from "./endpoints";
import type { TableauBordSp } from "@/portails/Sp/types/dashboard.interface";

/** `journee` (référence) prime sur `date` ; sans paramètre : journée du jour. */
export function resumeTableauBord(
  date?: string | null,
  journee?: string | null,
): Promise<TableauBordSp> {
  const params = new URLSearchParams();
  if (journee) params.set("journee", journee);
  else if (date) params.set("date", date);
  const query = params.size > 0 ? `?${params.toString()}` : "";
  return requeteApi<TableauBordSp>(
    `${SERVICE_PREVISION_ENDPOINTS.DASHBOARD}/resume${query}`,
  );
}
