import { requeteApi } from "@/shared/lib/api";
import { SERVICE_OPERATIONS_ENDPOINTS } from "./endpoints";
import type { PeriodeImportSof } from "./import-extraction";
import type { LotImportSof } from "@/portails/Sof/types/imports.interface";

const BASE = SERVICE_OPERATIONS_ENDPOINTS.RECETTES_TVA;

export type StatutTva = "ARRIERE" | "COURANT";
export type PerimetreTva = "petrole" | "hors-petrole";

function qs(params: Record<string, string | number | undefined | null>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== "") q.set(k, String(v));
  }
  const s = q.toString();
  return s ? `?${s}` : "";
}

// ── Rapprochement DC ↔ IG ────────────────────────────────────────────

export interface MandatDcTva {
  id: number;
  n_emis: string | null;
  n_regl: string | null;
  d_emis: string | null;
  dat_regl: string | null;
  pc: string | null;
  mdr: string | null;
  matric: string | null;
  nom: string | null;
  montant: string | null;
  m_net: string | null;
}

export interface OperationIgTva {
  id: number;
  c_pca: string | null;
  d_cpta: string | null;
  n_regl: string | null;
  n_op: string | null;
  n_mattir: string | null;
  l_np: string | null;
  c_mdr: string | null;
  m_regl: string | null;
}

export interface LigneRapprochementTva {
  id: number;
  statut: StatutTva;
  statut_libelle: string;
  petrole: boolean;
  apparie: boolean;
  dc: MandatDcTva;
  ig: OperationIgTva | null;
  ecart: string;
}

export interface RapprochementTvaPage {
  periode: PeriodeImportSof | null;
  lot_dc: LotImportSof | null;
  lot_ig: LotImportSof | null;
  lignes: LigneRapprochementTva[];
  ig_non_appariees: OperationIgTva[];
  nombre: number;
  nb_apparies: number;
  nb_non_apparies: number;
  total_dc: string;
  total_ig_apparie: string;
  total_ig_non_apparie: string;
  ecart: string;
  total_petrole: string;
  total_hors_petrole: string;
  par_statut: Record<StatutTva, { nombre: number; total_dc: string }>;
  message: string | null;
}

export function obtenirRapprochementTva(
  periodeId?: number,
): Promise<RapprochementTvaPage> {
  return requeteApi(`${BASE}/rapprochement${qs({ periode_id: periodeId })}`);
}

export function recalculerRapprochementTva(
  periodeId?: number,
): Promise<RapprochementTvaPage> {
  return requeteApi(`${BASE}/rapprochement/recalculer`, {
    method: "POST",
    body: JSON.stringify(periodeId != null ? { periode_id: periodeId } : {}),
    timeoutMs: 180_000,
  });
}

// ── Remboursements ───────────────────────────────────────────────────

export interface LigneRemboursementTva extends MandatDcTva {
  petrole: boolean;
  /** Montant IG (REG) — SPEC §5.4. */
  reg?: string;
  code_srot?: string;
  apparie?: boolean;
}

export interface BlocRemboursementsTva {
  lignes: LigneRemboursementTva[];
  nombre: number;
  total: string;
  total_petrole: string;
  total_hors_petrole: string;
  code_srot?: string;
}

export interface RemboursementsTvaPage {
  periode: PeriodeImportSof | null;
  lot: LotImportSof | null;
  arrieres: BlocRemboursementsTva;
  courants: BlocRemboursementsTva;
  nombre: number;
  total: string;
  total_petrole: string;
  total_hors_petrole: string;
  nb_ig_doublons?: number;
  codes?: { courant: string; arriere: string };
  message: string | null;
}

export function obtenirRemboursementsTva(params?: {
  periodeId?: number;
  perimetre?: PerimetreTva;
}): Promise<RemboursementsTvaPage> {
  return requeteApi(
    `${BASE}/remboursements${qs({
      periode_id: params?.periodeId,
      perimetre: params?.perimetre,
    })}`,
  );
}

export function recalculerRemboursementsTvaSrot(periodeId?: number): Promise<{
  srot: {
    exercice: number;
    nb_lignes: number;
    total_400: string;
    total_401: string;
    ig_doublons: string[];
  };
  remboursements: RemboursementsTvaPage;
}> {
  return requeteApi(`${BASE}/remboursements/recalculer`, {
    method: "POST",
    body: JSON.stringify(periodeId != null ? { periode_id: periodeId } : {}),
    timeoutMs: 180_000,
  });
}

// ── RAP ──────────────────────────────────────────────────────────────

export interface LigneRapTva {
  id: number;
  pc: string | null;
  mandat: string | null;
  d_emis: string | null;
  mdr: string | null;
  matric: string | null;
  nom: string | null;
  rap: string;
  d_visa: string | null;
  objet: string | null;
  c_blocag: string | null;
  bloque: boolean;
  petrole: boolean;
  mois: number | null;
  mois_libelle: string | null;
}

export interface RapTvaPage {
  periode: PeriodeImportSof | null;
  lot: LotImportSof | null;
  lignes: LigneRapTva[];
  par_pc: Array<{ pc: string; nombre: number; total: string }>;
  nombre: number;
  total: string;
  total_petrole?: string;
  total_hors_petrole?: string;
  total_bloque: string;
  total_non_bloque: string;
  message: string | null;
}

export function obtenirRapTva(periodeId?: number): Promise<RapTvaPage> {
  return requeteApi(`${BASE}/rap${qs({ periode_id: periodeId })}`);
}

// ── Synthèse TOFE & taux de change ───────────────────────────────────

export interface TauxChangeLigne {
  mois: number;
  devise: string;
  taux: string;
}

export interface LigneSyntheseTofe {
  code: string;
  libelle: string;
  nature?: string;
  montant: string;
  saisie?: boolean;
}

export interface MoisSyntheseTofe {
  mois: number;
  mois_libelle: string | null;
  remboursements_fcfa: string;
  cumul_fcfa: string;
  devises: Record<string, string>;
  courant: boolean;
}

export interface ConversionTofe {
  devise: string;
  taux_usd_xaf: string;
  rmp_assala_usd: string | null;
  rmp_assala_xaf: string | null;
  note?: string;
}

export interface TofeTvaPage {
  periode: PeriodeImportSof | null;
  lignes: LigneSyntheseTofe[];
  rubriques_tva: Array<{
    code: string;
    libelle: string;
    code_tofe: string | null;
    libelle_tofe: string | null;
  }>;
  par_mois: MoisSyntheseTofe[];
  total_exercice_fcfa?: string;
  taux_change: TauxChangeLigne[];
  conversion?: ConversionTofe;
  message: string | null;
}

export function obtenirTofeTva(periodeId?: number): Promise<TofeTvaPage> {
  return requeteApi(`${BASE}/tofe${qs({ periode_id: periodeId })}`);
}

export interface TauxChangePage {
  exercice_annee: number | null;
  devises: string[];
  taux: TauxChangeLigne[];
  message: string | null;
}

export function obtenirTauxChange(params?: {
  exerciceAnnee?: number;
  periodeId?: number;
}): Promise<TauxChangePage> {
  return requeteApi(
    `${BASE}/taux-change${qs({
      exercice_annee: params?.exerciceAnnee,
      periode_id: params?.periodeId,
    })}`,
  );
}

export function enregistrerTauxChange(donnees: {
  exercice_annee: number;
  taux: TauxChangeLigne[];
}): Promise<TauxChangePage> {
  return requeteApi(`${BASE}/taux-change`, {
    method: "PUT",
    body: JSON.stringify(donnees),
  });
}
