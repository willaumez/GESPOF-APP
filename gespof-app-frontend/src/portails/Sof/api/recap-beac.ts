import { requeteApi } from "@/shared/lib/api";
import { SERVICE_OPERATIONS_ENDPOINTS } from "./endpoints";
import type { LotImportSof } from "@/portails/Sof/types/imports.interface";

export interface LigneRecapBeac {
  id: number;
  code: string;
  type_recette: string;
  montant: string;
  petrole: boolean;
  nature: string;
}

export interface PeriodeRecapBeac {
  id: number;
  exercice_annee: number;
  mois: number;
  mois_libelle: string | null;
  date_situation: string | null;
  statut: string;
}

export interface RecapBeacSof {
  periode: PeriodeRecapBeac | null;
  lot: LotImportSof | null;
  date_debut: string | null;
  date_fin: string | null;
  lignes: LigneRecapBeac[];
  nombre: number;
  total: string;
  message: string | null;
}

export function obtenirRecapBeac(
  periodeId?: number,
): Promise<RecapBeacSof> {
  const q =
    periodeId != null
      ? `?periode_id=${encodeURIComponent(String(periodeId))}`
      : "";
  return requeteApi(
    `${SERVICE_OPERATIONS_ENDPOINTS.RECAP_BEAC}${q}`,
  );
}

export function importerRecapBeac(donnees: {
  date_debut: string;
  date_fin: string;
  periode_id?: number;
}): Promise<RecapBeacSof> {
  return requeteApi(`${SERVICE_OPERATIONS_ENDPOINTS.RECAP_BEAC}/importer`, {
    method: "POST",
    body: JSON.stringify(donnees),
  });
}
