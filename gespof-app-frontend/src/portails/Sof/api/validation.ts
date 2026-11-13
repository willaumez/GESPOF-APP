import { requeteApi, requeteApiBlob } from "@/shared/lib/api";
import { SERVICE_OPERATIONS_ENDPOINTS } from "./endpoints";

export type ControleCloture = {
  code: string;
  libelle: string;
  ok: boolean;
  detail: string;
};

export type ControlesPeriode = {
  periode: {
    id: number;
    exercice_annee: number;
    mois: number;
    statut: string;
    statut_libelle: string;
  };
  peut_valider: boolean;
  peut_publier: boolean;
  peut_rouvrir: boolean;
  controles: ControleCloture[];
};

export type PublicationSrot = {
  id: number;
  periode_id: number;
  exercice_annee: number;
  mois: number;
  version: number;
  type_document: string;
  libelle: string;
  composition_sections: string[];
  publie_le: string;
  publie_par: string | null;
};

export function obtenirControlesPeriode(
  periodeId?: number | null,
): Promise<ControlesPeriode> {
  if (periodeId) {
    return requeteApi(
      `${SERVICE_OPERATIONS_ENDPOINTS.PERIODES_ACTIONS}/${periodeId}/controles`,
    );
  }
  return requeteApi(
    `${SERVICE_OPERATIONS_ENDPOINTS.PERIODES_ACTIONS}/controles`,
  );
}

export function validerPeriode(periodeId: number): Promise<{
  periode: ControlesPeriode["periode"];
  message: string;
}> {
  return requeteApi(
    `${SERVICE_OPERATIONS_ENDPOINTS.PERIODES_ACTIONS}/${periodeId}/valider`,
    { method: "POST", body: "{}" },
  );
}

export function publierPeriode(
  periodeId: number,
  typeDocument = "srot",
): Promise<{
  periode: ControlesPeriode["periode"];
  publication: PublicationSrot;
  message: string;
}> {
  return requeteApi(
    `${SERVICE_OPERATIONS_ENDPOINTS.PERIODES_ACTIONS}/${periodeId}/publier`,
    {
      method: "POST",
      body: JSON.stringify({ type_document: typeDocument }),
    },
  );
}

export function rouvrirPeriode(
  periodeId: number,
  motif: string,
): Promise<{ periode: ControlesPeriode["periode"]; message: string }> {
  return requeteApi(
    `${SERVICE_OPERATIONS_ENDPOINTS.PERIODES_ACTIONS}/${periodeId}/rouvrir`,
    {
      method: "POST",
      body: JSON.stringify({ motif }),
    },
  );
}

export function listerPublications(opts?: {
  exercice?: number;
  periodeId?: number;
}): Promise<{ publications: PublicationSrot[] }> {
  const params = new URLSearchParams();
  if (opts?.exercice) params.set("exercice", String(opts.exercice));
  if (opts?.periodeId) params.set("periode_id", String(opts.periodeId));
  const q = params.toString() ? `?${params}` : "";
  return requeteApi(
    `${SERVICE_OPERATIONS_ENDPOINTS.PERIODES_ACTIONS}/publications${q}`,
  );
}

export async function telechargerExportPeriode(
  periodeId: number,
  format: "html" | "pdf" | "json" = "html",
): Promise<void> {
  const blob = await requeteApiBlob(
    `${SERVICE_OPERATIONS_ENDPOINTS.PERIODES_ACTIONS}/${periodeId}/export?format=${format}`,
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `SROT_${periodeId}.${format === "json" ? "json" : "html"}`;
  a.click();
  URL.revokeObjectURL(url);
}
