import { requeteApi } from "@/shared/lib/api";
import { SERVICE_OPERATIONS_ENDPOINTS } from "./endpoints";
import type { LotImportSof } from "@/portails/Sof/types/imports.interface";

export interface FeuilleIgPetrole {
  compte: string;
  nature: string | null;
  libelle: string;
  cle: string;
  lot: LotImportSof | null;
  nb_lignes: number;
  montant_total: string;
}

export interface LigneIgOperation {
  id: number;
  c_pca: string | null;
  d_cpta: string | null;
  n_regl: string | null;
  n_lig_r: number | null;
  c_typ_op: string | null;
  n_op: string | null;
  c_guic: string | null;
  n_mattir: string | null;
  l_np: string | null;
  c_ope: string | null;
  c_it: string | null;
  c_nat: string | null;
  c_ref1: string | null;
  c_ref2: string | null;
  m_regl: string | null;
  c_nop: string | null;
  c_mdr: string | null;
  n_cheq: string | null;
  c_cais: string | null;
  l_tiers: string | null;
}

export function listerFeuillesIgPetrole(
  periodeId?: number,
): Promise<{
  periode: { id: number } | null;
  feuilles: FeuilleIgPetrole[];
  message: string | null;
}> {
  const q =
    periodeId != null
      ? `?periode_id=${encodeURIComponent(String(periodeId))}`
      : "";
  return requeteApi(
    `${SERVICE_OPERATIONS_ENDPOINTS.IG_OPERATIONS_PETROLE}${q}`,
  );
}

export function obtenirFeuilleIgPetrole(params: {
  compte: string;
  nature?: string | null;
  periode_id?: number;
}): Promise<{
  feuille: { compte: string; nature: string | null; libelle: string; cle: string };
  lot: LotImportSof | null;
  lignes: LigneIgOperation[];
  nombre: number;
  total: string;
  message: string | null;
}> {
  const q = new URLSearchParams();
  q.set("compte", params.compte);
  if (params.nature != null && params.nature !== "") {
    q.set("nature", params.nature);
  }
  if (params.periode_id != null) {
    q.set("periode_id", String(params.periode_id));
  }
  return requeteApi(
    `${SERVICE_OPERATIONS_ENDPOINTS.IG_OPERATIONS_PETROLE}/feuille?${q}`,
  );
}

export function importerOperationsIgPetrole(donnees: {
  date_debut: string;
  date_fin: string;
  periode_id?: number;
}): Promise<{
  feuilles: Array<{
    compte: string;
    nature: string | null;
    libelle: string;
    cle: string;
    lot_id: number;
    nb_lignes: number;
    montant_total: string;
  }>;
  message: string | null;
}> {
  return requeteApi(
    `${SERVICE_OPERATIONS_ENDPOINTS.IG_OPERATIONS_PETROLE}/importer`,
    { method: "POST", body: JSON.stringify(donnees) },
  );
}
