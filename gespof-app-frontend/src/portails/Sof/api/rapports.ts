import { requeteApi, requeteApiBlob } from "@/shared/lib/api";
import { SERVICE_OPERATIONS_ENDPOINTS } from "./endpoints";

function q(periodeId?: number | null, extra?: Record<string, string>): string {
  const params = new URLSearchParams();
  if (periodeId) params.set("periode_id", String(periodeId));
  if (extra) for (const [k, v] of Object.entries(extra)) params.set(k, v);
  const s = params.toString();
  return s ? `?${s}` : "";
}

export function obtenirFicheSrot(periodeId?: number | null) {
  return requeteApi<{
    periode: { id: number; exercice_annee: number; mois: number; statut: string };
    variables: Array<{ nom: string; valeur: string; source: string }>;
    commentaires: Record<string, string>;
    note?: string;
  }>(`${SERVICE_OPERATIONS_ENDPOINTS.RAPPORTS}/fiche-srot${q(periodeId)}`);
}

export function enregistrerCommentairesFiche(donnees: {
  periode_id: number;
  commentaires: Record<string, string>;
}) {
  return requeteApi(
    `${SERVICE_OPERATIONS_ENDPOINTS.RAPPORTS}/fiche-srot/commentaires`,
    { method: "PUT", body: JSON.stringify(donnees) },
  );
}

export async function telechargerFicheSrot(periodeId?: number | null) {
  const blob = await requeteApiBlob(
    `${SERVICE_OPERATIONS_ENDPOINTS.RAPPORTS}/fiche-srot/export${q(periodeId)}`,
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "Fiche_SROT.html";
  a.click();
  URL.revokeObjectURL(url);
}

export function obtenirTableauDeBord(periodeId?: number | null) {
  return requeteApi<{
    periode: { id: number; exercice_annee: number; mois: number };
    srot: Record<string, string>;
    hors_srot: {
      cours: Array<{
        mois: number;
        brent: string;
        usd_xaf: string;
        prevision_lf: string;
      }>;
      ota_ressources: string;
      ota_charges: string;
      tmp_bta: string;
      pmp_ota: string;
      pib_nominal: string;
      debits_t1: string;
      debits_t2: string;
      debits_t3: string;
    };
  }>(`${SERVICE_OPERATIONS_ENDPOINTS.RAPPORTS}/tableau-de-bord${q(periodeId)}`);
}

export function enregistrerHorsSrot(donnees: {
  exercice: number;
  valeurs: Array<{ code: string; mois: number; valeur: string }>;
}) {
  return requeteApi(
    `${SERVICE_OPERATIONS_ENDPOINTS.RAPPORTS}/tableau-de-bord/hors-srot`,
    { method: "PUT", body: JSON.stringify(donnees) },
  );
}

export function obtenirDgbfip(periodeId?: number | null, loi = "LFR") {
  return requeteApi<{
    parametres: { annee: number; loi: string; mois: number };
    onglets: {
      recettes: Array<Record<string, string | number | null | string[]>>;
      depenses: Array<Record<string, string | number | null>>;
      tresorerie: Array<Record<string, string>>;
    };
    note?: string;
  }>(
    `${SERVICE_OPERATIONS_ENDPOINTS.RAPPORTS}/dgbfip${q(periodeId, { loi })}`,
  );
}

export async function telechargerDgbfip(
  periodeId?: number | null,
  loi = "LFR",
) {
  const blob = await requeteApiBlob(
    `${SERVICE_OPERATIONS_ENDPOINTS.RAPPORTS}/dgbfip/export${q(periodeId, { loi })}`,
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "DGBFiP.xlsx";
  a.click();
  URL.revokeObjectURL(url);
}
