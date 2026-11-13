import { requeteApi } from "@/shared/lib/api";
import { SERVICE_OPERATIONS_ENDPOINTS } from "./endpoints";

export type LigneSituation = {
  id: string;
  libelle: string;
  niveau: number;
  section: boolean;
  cumul_precedent: string;
  mois: string;
  cumul: string;
};

export type LigneSoldes = {
  id: string;
  libelle: string;
  mois: string;
  cumul: string;
  _fw?: number;
};

export type LigneEquilibre = {
  id: string;
  libelle: string;
  niveau: number;
  section: boolean;
  lfi: string | null;
  lfr: string | null;
  prevision: string | null;
  execution: string | null;
  taux: string | null;
  prevision_cumulee: string | null;
  execution_cumulee: string | null;
  taux_cumule: string | null;
};

export type LigneFicheDepot = {
  id: number;
  code: string;
  categorie: string;
  domiciliation: string | null;
  libelle: string;
  devise: string;
  montant_01_01: string;
  montant_situation: string;
  ordre: number;
};

function qPeriode(periodeId?: number | null): string {
  return periodeId ? `?periode_id=${periodeId}` : "";
}

export function obtenirSituationSrot(periodeId?: number | null): Promise<{
  periode: { id: number; exercice_annee: number; mois: number; statut: string };
  lignes: LigneSituation[];
  note?: string;
}> {
  return requeteApi(
    `${SERVICE_OPERATIONS_ENDPOINTS.SROT}/situation${qPeriode(periodeId)}`,
  );
}

export function obtenirSoldesSrot(periodeId?: number | null): Promise<{
  periode: { id: number; exercice_annee: number; mois: number };
  lignes: LigneSoldes[];
}> {
  return requeteApi(
    `${SERVICE_OPERATIONS_ENDPOINTS.SROT}/soldes${qPeriode(periodeId)}`,
  );
}

export function obtenirEquilibreSrot(periodeId?: number | null): Promise<{
  periode: { id: number; exercice_annee: number; mois: number };
  lignes: LigneEquilibre[];
  note?: string;
}> {
  return requeteApi(
    `${SERVICE_OPERATIONS_ENDPOINTS.SROT}/equilibre${qPeriode(periodeId)}`,
  );
}

export function listerFicheDepots(periodeId?: number | null): Promise<{
  exercice: number;
  lignes: LigneFicheDepot[];
  totaux: { montant_01_01: string; montant_situation: string };
}> {
  return requeteApi(
    `${SERVICE_OPERATIONS_ENDPOINTS.SROT}/depots${qPeriode(periodeId)}`,
  );
}

export function enregistrerFicheDepots(donnees: {
  exercice: number;
  lignes: Array<{
    code: string;
    montant_01_01?: string;
    montant_situation?: string;
    libelle?: string;
    domiciliation?: string | null;
    devise?: string;
  }>;
}): Promise<{
  exercice: number;
  lignes: LigneFicheDepot[];
  totaux: { montant_01_01: string; montant_situation: string };
}> {
  return requeteApi(`${SERVICE_OPERATIONS_ENDPOINTS.SROT}/depots`, {
    method: "PUT",
    body: JSON.stringify(donnees),
  });
}
