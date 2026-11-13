import { requeteApi } from "@/shared/lib/api";
import { SERVICE_OPERATIONS_ENDPOINTS } from "./endpoints";

export type LigneEtatRdModel = {
  code: string;
  libelle: string;
  niveau: number;
  code_synthetique: boolean;
  mois: string;
  cumul: string;
  millions_mois: string;
  millions_cumul: string;
  nature?: string;
  nature_libelle?: string;
  section?: string;
  section_libelle?: string;
};

export type EtatRdModel = {
  exercice: number;
  mois: number;
  origine: string;
  unite: string;
  formule: string;
  lignes: LigneEtatRdModel[];
  totaux: {
    mois: string;
    cumul: string;
    millions_mois: string;
    millions_cumul: string;
  };
};

export function obtenirEtatDepensesRdModel(
  periodeId?: number | null,
  mode: "auto" | "srot" = "srot",
): Promise<{ etat: EtatRdModel }> {
  const params = new URLSearchParams();
  if (periodeId) params.set("periode_id", String(periodeId));
  params.set("mode", mode);
  return requeteApi(
    `${SERVICE_OPERATIONS_ENDPOINTS.RD_MODEL}/depenses?${params}`,
  );
}

export function obtenirEtatRecettesRdModel(
  periodeId?: number | null,
  mode: "auto" | "srot" = "srot",
): Promise<{ etat: EtatRdModel }> {
  const params = new URLSearchParams();
  if (periodeId) params.set("periode_id", String(periodeId));
  params.set("mode", mode);
  return requeteApi(
    `${SERVICE_OPERATIONS_ENDPOINTS.RD_MODEL}/recettes?${params}`,
  );
}

export function recalculerCumulRdModel(params: {
  exercice?: number;
  periode_id?: number | null;
}): Promise<{ cumul: { exercice: number; nb_cellules: number; nb_codes: number; total: string } }> {
  return requeteApi(`${SERVICE_OPERATIONS_ENDPOINTS.RD_MODEL}/cumul/recalculer`, {
    method: "POST",
    body: JSON.stringify(params),
  });
}
