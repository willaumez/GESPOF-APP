import { requeteApi } from "@/shared/lib/api";
import { SERVICE_OPERATIONS_ENDPOINTS } from "./endpoints";

export type LigneAppuiEmprunt = {
  code_m: string;
  code_srot: string | null;
  libelle: string;
  sens: string;
  mois: string[];
  montant_mois: string;
  cumul: string;
};

export type AppuisEmpruntsPage = {
  periode: { id: number; exercice_annee: number; mois: number } | null;
  exercice: number;
  mois: number;
  lignes: LigneAppuiEmprunt[];
  message: string | null;
};

export function obtenirAppuisEmprunts(
  periodeId?: number,
): Promise<AppuisEmpruntsPage> {
  const q = periodeId != null ? `?periode_id=${periodeId}` : "";
  return requeteApi(
    `${SERVICE_OPERATIONS_ENDPOINTS.RECETTES_APPUIS_EMPRUNTS}${q}`,
  );
}

export function recalculerAppuisEmprunts(periodeId?: number): Promise<{
  nb_lignes: number;
  etat: AppuisEmpruntsPage;
}> {
  return requeteApi(
    `${SERVICE_OPERATIONS_ENDPOINTS.RECETTES_APPUIS_EMPRUNTS}/recalculer`,
    {
      method: "POST",
      body: JSON.stringify(
        periodeId != null ? { periode_id: periodeId } : {},
      ),
    },
  );
}
