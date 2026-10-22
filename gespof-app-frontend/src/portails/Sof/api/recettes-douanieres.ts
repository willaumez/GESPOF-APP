import { requeteApi } from "@/shared/lib/api";
import { SERVICE_OPERATIONS_ENDPOINTS } from "./endpoints";
import type {
  ExtractionCompteDouane,
  ExtractionLotDouane,
  GroupeCompteDouane,
} from "@/portails/Sof/types/recettes-douanieres.interface";

const BASE = SERVICE_OPERATIONS_ENDPOINTS.RECETTES_DOUANIERES;

export function listerComptesDouane(): Promise<{ comptes: GroupeCompteDouane[] }> {
  return requeteApi(`${BASE}/comptes`);
}

export function extraireCompteDouane(
  dateDebut: string,
  dateFin: string,
  compte: string,
): Promise<ExtractionCompteDouane> {
  const query = new URLSearchParams({
    date_debut: dateDebut,
    date_fin: dateFin,
    compte,
  });
  return requeteApi(`${BASE}/extraction?${query.toString()}`, { timeoutMs: 180_000 });
}

export function extraireLotDouane(
  dateDebut: string,
  dateFin: string,
): Promise<ExtractionLotDouane> {
  const query = new URLSearchParams({
    date_debut: dateDebut,
    date_fin: dateFin,
  });
  return requeteApi(`${BASE}/extraction/lot?${query.toString()}`, { timeoutMs: 300_000 });
}

export function extraireRusid(
  dateDebut: string,
  dateFin: string,
): Promise<ExtractionCompteDouane> {
  const query = new URLSearchParams({
    date_debut: dateDebut,
    date_fin: dateFin,
  });
  return requeteApi(`${BASE}/extraction/rusid?${query.toString()}`, { timeoutMs: 180_000 });
}
