import { requeteApi } from "@/shared/lib/api";
import { SERVICE_OPERATIONS_ENDPOINTS } from "./endpoints";
import type {
  LigneRapprochement,
  RapprochementPage,
} from "./recettes-petrolieres-pages";

const BASE = SERVICE_OPERATIONS_ENDPOINTS.RECETTES_DOUANIERES_PAGES;

export type { LigneRapprochement };

export interface GroupeRapprochementDouane {
  libelle: string;
  lignes: LigneRapprochement[];
}

export interface RapprochementDouanePage extends RapprochementPage {
  groupes: GroupeRapprochementDouane[];
}

export function obtenirRapprochementDouane(
  periodeId?: number,
): Promise<RapprochementDouanePage> {
  const q =
    periodeId != null
      ? `?periode_id=${encodeURIComponent(String(periodeId))}`
      : "";
  return requeteApi(`${BASE}/rapprochement${q}`);
}

export function enregistrerLigneRapprochementDouane(donnees: {
  periode_id: number;
  cle: string;
  montant_externe?: string;
  commentaire?: string | null;
}): Promise<{ ligne: LigneRapprochement }> {
  return requeteApi(`${BASE}/rapprochement/ligne`, {
    method: "PUT",
    body: JSON.stringify(donnees),
  });
}

export function validerRapprochementDouane(
  periodeId?: number,
): Promise<RapprochementDouanePage> {
  return requeteApi(`${BASE}/rapprochement/valider`, {
    method: "POST",
    body: JSON.stringify(
      periodeId != null ? { periode_id: periodeId } : {},
    ),
  });
}

export interface VueAnnuelleDouanePage {
  exercice_annee: number | null;
  mois_courant: number | null;
  mois_libelles: string[];
  lignes: Array<{ compte: string; montants: string[] }>;
  totaux: string[];
  message: string | null;
}

export function obtenirVueAnnuelleDouane(params?: {
  periodeId?: number;
}): Promise<VueAnnuelleDouanePage> {
  const q = new URLSearchParams();
  if (params?.periodeId != null) q.set("periode_id", String(params.periodeId));
  const qs = q.toString();
  return requeteApi(`${BASE}/annuelle${qs ? `?${qs}` : ""}`);
}

export function recalculerVueAnnuelleDouane(
  periodeId?: number,
): Promise<VueAnnuelleDouanePage> {
  return requeteApi(`${BASE}/annuelle/recalculer`, {
    method: "POST",
    body: JSON.stringify(periodeId != null ? { periode_id: periodeId } : {}),
  });
}
