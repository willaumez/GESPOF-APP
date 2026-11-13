import { requeteApi } from "@/shared/lib/api";
import { SERVICE_OPERATIONS_ENDPOINTS } from "./endpoints";
import type { RecapBeacSof } from "./recap-beac";

const BASE = SERVICE_OPERATIONS_ENDPOINTS.RECETTES_PETROLIERES_PAGES;

export function obtenirRecapBeacPage(periodeId?: number): Promise<RecapBeacSof> {
  const q =
    periodeId != null
      ? `?periode_id=${encodeURIComponent(String(periodeId))}`
      : "";
  return requeteApi(`${BASE}/recap-beac${q}`);
}

export interface LigneQualification {
  ig_operation_id: number;
  d_cpta: string | null;
  n_regl: string | null;
  n_mattir: string | null;
  societe_matricule: string | null;
  societe_nom: string | null;
  montant: string;
  mode: string;
  c_nop: string | null;
  type_recette: string;
  type_recette_libelle: string;
  verifie_bgfi: boolean;
  exclu: boolean;
  motif: string | null;
}

export interface QualificationPage {
  periode: { id: number; mois: number; exercice_annee: number; mois_libelle: string | null } | null;
  lot: { id: number; reference: string; nb_lignes: number; montant_total: string } | null;
  lignes: LigneQualification[];
  kpis: { operations: number; non_qualifiees: number; verifiees_bgfi: number };
  types: Array<{ valeur: string; libelle: string }>;
  message: string | null;
}

export function listerQualifications(
  periodeId?: number,
  afficherNa = false,
): Promise<QualificationPage> {
  const q = new URLSearchParams();
  if (periodeId != null) q.set("periode_id", String(periodeId));
  if (afficherNa) q.set("afficher_na", "1");
  const qs = q.toString();
  return requeteApi(`${BASE}/transferts${qs ? `?${qs}` : ""}`);
}

export function enregistrerQualification(
  igOperationId: number,
  donnees: Partial<{
    type_recette: string;
    societe_matricule: string | null;
    verifie_bgfi: boolean;
    exclu: boolean;
    motif: string | null;
  }>,
): Promise<{ qualification: LigneQualification }> {
  return requeteApi(`${BASE}/transferts/${igOperationId}`, {
    method: "PUT",
    body: JSON.stringify(donnees),
  });
}

export interface ConsolidationPage {
  periode: { id: number; mois: number; exercice_annee: number; mois_libelle: string | null } | null;
  lignes: Array<{
    type: string;
    type_libelle: string;
    rubrique_code: string;
    montant: string;
  }>;
  total: string;
  alertes: Array<{
    titre: string;
    detail: string;
    ig_operation_id: number;
    exclu: boolean;
  }>;
  message: string | null;
}

export function obtenirConsolidation(periodeId?: number): Promise<ConsolidationPage> {
  const q =
    periodeId != null
      ? `?periode_id=${encodeURIComponent(String(periodeId))}`
      : "";
  return requeteApi(`${BASE}/consolidation${q}`);
}

export function recalculerConsolidation(periodeId?: number): Promise<ConsolidationPage> {
  return requeteApi(`${BASE}/consolidation/recalculer`, {
    method: "POST",
    body: JSON.stringify(periodeId != null ? { periode_id: periodeId } : {}),
  });
}

export interface DetailSocieteEnfant {
  matricule: string | null;
  nom: string;
  champ_nif: string | null;
  montants: string[];
}

export interface DetailSocieteGroupe {
  type: string;
  type_libelle: string;
  rubrique_code: string | null;
  montants: string[];
  societes: DetailSocieteEnfant[];
}

export interface DetailParSocietePage {
  exercice_annee: number | null;
  mois_courant: number | null;
  mois_libelles: string[];
  societes: Array<{ matricule: string; nom: string }>;
  groupes: DetailSocieteGroupe[];
  totaux: string[];
  message: string | null;
}

export function obtenirDetailParSociete(params?: {
  periodeId?: number;
  societe?: string;
}): Promise<DetailParSocietePage> {
  const q = new URLSearchParams();
  if (params?.periodeId != null) q.set("periode_id", String(params.periodeId));
  if (params?.societe && params.societe !== "Toutes") {
    q.set("societe", params.societe);
  }
  const qs = q.toString();
  return requeteApi(`${BASE}/societes${qs ? `?${qs}` : ""}`);
}

export interface LigneRapprochement {
  id: number | null;
  cle: string;
  libelle: string;
  montant_domf: string;
  montant_externe: string;
  ecart: string;
  commentaire: string | null;
  valide: boolean;
  valide_par: string | null;
  valide_le: string | null;
}

export interface RapprochementPage {
  periode: {
    id: number;
    mois: number;
    exercice_annee: number;
    mois_libelle: string | null;
  } | null;
  domaine: string;
  lignes: LigneRapprochement[];
  ecart_total: string;
  ecarts_commentes: boolean;
  valide: boolean;
  message: string | null;
}

export function obtenirRapprochementDrphp(
  periodeId?: number,
): Promise<RapprochementPage> {
  const q =
    periodeId != null
      ? `?periode_id=${encodeURIComponent(String(periodeId))}`
      : "";
  return requeteApi(`${BASE}/rapprochement${q}`);
}

export function enregistrerLigneRapprochement(donnees: {
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

export function validerRapprochementDrphp(
  periodeId?: number,
): Promise<RapprochementPage> {
  return requeteApi(`${BASE}/rapprochement/valider`, {
    method: "POST",
    body: JSON.stringify(periodeId != null ? { periode_id: periodeId } : {}),
  });
}
