import { requeteApi } from "@/shared/lib/api";
import { SERVICE_OPERATIONS_ENDPOINTS } from "./endpoints";
import type {
  ExtractionEtatsLiquidation,
  ExtractionOperationsDope,
  ExtractionReglements,
} from "@/portails/Sof/types/depenses.interface";

const BASE = SERVICE_OPERATIONS_ENDPOINTS.DEPENSES;

function queryPeriode(dateDebut: string, dateFin: string): string {
  return new URLSearchParams({
    date_debut: dateDebut,
    date_fin: dateFin,
  }).toString();
}

export function extraireAvancesEtat(
  dateDebut: string,
  dateFin: string,
): Promise<ExtractionOperationsDope> {
  return requeteApi(`${BASE}/avances/etat?${queryPeriode(dateDebut, dateFin)}`, {
    timeoutMs: 180_000,
  });
}

export function extraireAvancesPoste(
  dateDebut: string,
  dateFin: string,
): Promise<ExtractionOperationsDope> {
  return requeteApi(`${BASE}/avances/poste?${queryPeriode(dateDebut, dateFin)}`, {
    timeoutMs: 180_000,
  });
}

export function extraireEtatsLiquidation(
  dateDebut: string,
  dateFin: string,
): Promise<ExtractionEtatsLiquidation> {
  return requeteApi(`${BASE}/etats-liquidation?${queryPeriode(dateDebut, dateFin)}`, {
    timeoutMs: 180_000,
  });
}

export function extraireReglements(
  dateDebut: string,
  dateFin: string,
): Promise<ExtractionReglements> {
  return requeteApi(`${BASE}/reglements?${queryPeriode(dateDebut, dateFin)}`, {
    timeoutMs: 180_000,
  });
}

export function extraireCreditsDelegues(
  dateDebut: string,
  dateFin: string,
): Promise<ExtractionOperationsDope> {
  return requeteApi(`${BASE}/credits-delegues?${queryPeriode(dateDebut, dateFin)}`, {
    timeoutMs: 180_000,
  });
}
