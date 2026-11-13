import { requeteApi } from "@/shared/lib/api";
import { SERVICE_OPERATIONS_ENDPOINTS } from "./endpoints";
import type {
  ExecutionN1Sof,
  GrilleSof,
  LoiFinancesSof,
  RapAnterieurSof,
  TypeGrilleSof,
  TypeLoiFinances,
} from "@/portails/Sof/types/parametrage.interface";

export function listerLoisFinances(
  exerciceAnnee: number,
): Promise<{ lois: LoiFinancesSof[] }> {
  return requeteApi(
    `${SERVICE_OPERATIONS_ENDPOINTS.LOI_FINANCES}/${exerciceAnnee}`,
  );
}

export function obtenirLoiFinances(
  exerciceAnnee: number,
  type: TypeLoiFinances,
): Promise<{ loi: LoiFinancesSof }> {
  return requeteApi(
    `${SERVICE_OPERATIONS_ENDPOINTS.LOI_FINANCES}/${exerciceAnnee}/${type}`,
  );
}

export function enregistrerLoiFinances(
  exerciceAnnee: number,
  type: TypeLoiFinances,
  donnees: Partial<LoiFinancesSof>,
): Promise<{ loi: LoiFinancesSof }> {
  return requeteApi(
    `${SERVICE_OPERATIONS_ENDPOINTS.LOI_FINANCES}/${exerciceAnnee}/${type}`,
    { method: "PUT", body: JSON.stringify(donnees) },
  );
}

export function obtenirGrille(
  exerciceAnnee: number,
  type: TypeGrilleSof,
): Promise<{ grille: GrilleSof }> {
  return requeteApi(
    `${SERVICE_OPERATIONS_ENDPOINTS.GRILLES}/${exerciceAnnee}/${type}`,
  );
}

export function enregistrerGrille(
  exerciceAnnee: number,
  type: TypeGrilleSof,
  donnees: { unite_saisie?: string; lignes: GrilleSof["lignes"] },
): Promise<{ grille: GrilleSof }> {
  return requeteApi(
    `${SERVICE_OPERATIONS_ENDPOINTS.GRILLES}/${exerciceAnnee}/${type}`,
    { method: "PUT", body: JSON.stringify(donnees) },
  );
}

export function obtenirExecutionN1(
  exerciceCourant: number,
): Promise<ExecutionN1Sof> {
  return requeteApi(
    `${SERVICE_OPERATIONS_ENDPOINTS.EXECUTION_N1}/${exerciceCourant}`,
  );
}

export function enregistrerExecutionN1(
  exerciceCourant: number,
  donnees: { lignes: ExecutionN1Sof["lignes"] },
): Promise<ExecutionN1Sof> {
  return requeteApi(
    `${SERVICE_OPERATIONS_ENDPOINTS.EXECUTION_N1}/${exerciceCourant}`,
    { method: "PUT", body: JSON.stringify(donnees) },
  );
}

export function obtenirRapAnterieurs(
  exerciceAnnee: number,
): Promise<RapAnterieurSof> {
  return requeteApi(
    `${SERVICE_OPERATIONS_ENDPOINTS.RAP_ANTERIEURS}/${exerciceAnnee}`,
  );
}

export function importerRapAnterieurs(
  exerciceAnnee: number,
  donnees: {
    fichier?: string;
    lignes: RapAnterieurSof["lignes"];
  },
): Promise<RapAnterieurSof> {
  return requeteApi(
    `${SERVICE_OPERATIONS_ENDPOINTS.RAP_ANTERIEURS}/${exerciceAnnee}`,
    { method: "POST", body: JSON.stringify(donnees) },
  );
}
