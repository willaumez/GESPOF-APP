import { requeteApi } from "@/shared/lib/api";
import { SERVICE_OPERATIONS_ENDPOINTS } from "./endpoints";

function q(periodeId?: number | null, extra?: Record<string, string>): string {
  const params = new URLSearchParams();
  if (periodeId) params.set("periode_id", String(periodeId));
  if (extra) {
    for (const [k, v] of Object.entries(extra)) params.set(k, v);
  }
  const s = params.toString();
  return s ? `?${s}` : "";
}

export function obtenirSituationRap(
  periodeId?: number | null,
  vue?: string,
): Promise<{
  periode: { id: number; exercice_annee: number; mois: number };
  kpis: {
    nb_lignes: number;
    total_rap: string;
    nb_rap_negatifs: number;
  };
  vues: string[];
  agrege_vues: Record<string, { nb: number; rap: string; brut: string }>;
  synthese: {
    lignes: Array<{
      c_categ: string;
      type: string;
      exercice: string;
      rap: string;
    }>;
    totaux: { antérieurs: string; exercice: string; total: string };
  };
  lignes: Array<Record<string, string | number | null>>;
  note?: string;
}> {
  return requeteApi(
    `${SERVICE_OPERATIONS_ENDPOINTS.EXECUTION}/rap${q(
      periodeId,
      vue ? { vue } : undefined,
    )}`,
  );
}

export function obtenirRapSynthese(periodeId?: number | null): Promise<{
  synthese: {
    lignes: Array<{
      c_categ: string;
      type: string;
      exercice: string;
      rap: string;
    }>;
    totaux: { antérieurs: string; exercice: string; total: string };
  };
  kpis: Record<string, string | number>;
}> {
  return requeteApi(
    `${SERVICE_OPERATIONS_ENDPOINTS.EXECUTION}/rap/synthese${q(periodeId)}`,
  );
}

export function obtenirExecutionTitres(periodeId?: number | null) {
  return requeteApi<{
    lignes: Array<Record<string, string | number | null | boolean>>;
    blocage_publication?: boolean;
    note?: string;
  }>(
    `${SERVICE_OPERATIONS_ENDPOINTS.EXECUTION}/depenses/titres${q(periodeId)}`,
  );
}

export function obtenirExecutionTitresNatures(periodeId?: number | null) {
  return requeteApi<{
    lignes: Array<Record<string, string | number | null | boolean>>;
  }>(
    `${SERVICE_OPERATIONS_ENDPOINTS.EXECUTION}/depenses/titres-natures${q(periodeId)}`,
  );
}

export function obtenirExecutionMissions(periodeId?: number | null) {
  return requeteApi<{
    lignes: Array<Record<string, string | number | null | boolean>>;
  }>(
    `${SERVICE_OPERATIONS_ENDPOINTS.EXECUTION}/depenses/missions${q(periodeId)}`,
  );
}

export function obtenirHorsOrdonnances(periodeId?: number | null) {
  return requeteApi<{
    kpis: {
      nb_lignes: number;
      total_hors: string;
      part_pct: string;
    };
    lignes: Array<Record<string, string | number | null>>;
  }>(
    `${SERVICE_OPERATIONS_ENDPOINTS.EXECUTION}/depenses/hors-ordonnances${q(periodeId)}`,
  );
}

export function obtenirResumeExecution(periodeId?: number | null) {
  return requeteApi<{
    lignes: Array<Record<string, string | number | null>>;
  }>(`${SERVICE_OPERATIONS_ENDPOINTS.EXECUTION}/resume${q(periodeId)}`);
}
