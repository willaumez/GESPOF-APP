import { requeteApi } from "@/shared/lib/api";
import { SERVICE_OPERATIONS_ENDPOINTS } from "./endpoints";
import type {
  ExtractionRapTva,
  ExtractionRemboursementsTvaDc,
  ExtractionRemboursementsTvaIg,
} from "@/portails/Sof/types/tva.interface";

const BASE = SERVICE_OPERATIONS_ENDPOINTS.TVA;

function queryPeriode(dateDebut: string, dateFin: string): string {
  return new URLSearchParams({
    date_debut: dateDebut,
    date_fin: dateFin,
  }).toString();
}

export function extraireRapTva(
  dateDebut: string,
  dateFin: string,
): Promise<ExtractionRapTva> {
  return requeteApi(`${BASE}/rap?${queryPeriode(dateDebut, dateFin)}`, {
    timeoutMs: 180_000,
  });
}

export function extraireRemboursementsTvaDc(
  dateDebut: string,
  dateFin: string,
): Promise<ExtractionRemboursementsTvaDc> {
  return requeteApi(`${BASE}/remboursements-dc?${queryPeriode(dateDebut, dateFin)}`, {
    timeoutMs: 180_000,
  });
}

export function extraireRemboursementsTvaIg(
  dateDebut: string,
  dateFin: string,
): Promise<ExtractionRemboursementsTvaIg> {
  return requeteApi(`${BASE}/remboursements-ig?${queryPeriode(dateDebut, dateFin)}`, {
    timeoutMs: 180_000,
  });
}
