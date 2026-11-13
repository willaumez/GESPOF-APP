import { requeteApi } from "@/shared/lib/api";
import { SERVICE_OPERATIONS_ENDPOINTS } from "./endpoints";
import type { PeriodeImportSof } from "./import-extraction";

const BASE = SERVICE_OPERATIONS_ENDPOINTS.RECETTES_FISCALES;

export type ModeRecouvrement = "ETAX" | "SWIFT" | "NUMERAIRE" | "BANCAIRE";

export interface ModeRecouvrementInfo {
  code: ModeRecouvrement;
  libelle: string;
}

/** Série annuelle (index 0 = janvier … 11 = décembre), montants FCFA en string. */
export type SerieMois = string[];

export interface ModeLigneAnnuelle {
  code: ModeRecouvrement;
  libelle: string;
  mois: SerieMois;
}

export interface LigneFiscaleMode {
  rubrique_code: string;
  libelle: string;
  niveau: number;
  /** Total tous modes. */
  mois: SerieMois;
  /** Détail par mode pour la saisie. */
  par_mode: Record<ModeRecouvrement, SerieMois>;
}

export interface FiscalesModePage {
  periode: PeriodeImportSof | null;
  /** mois 1..12 → periode_id */
  periodes_mois: Record<string, number>;
  modes: ModeRecouvrementInfo[];
  modes_lignes: ModeLigneAnnuelle[];
  lignes: LigneFiscaleMode[];
  message: string | null;
}

export function obtenirFiscalesMode(
  periodeId?: number,
): Promise<FiscalesModePage> {
  const q = periodeId != null ? `?periode_id=${periodeId}` : "";
  return requeteApi(`${BASE}/mode${q}`);
}

export function enregistrerFiscalesMode(donnees: {
  periode_id?: number;
  lignes: Array<{
    rubrique_code: string;
    mode: ModeRecouvrement;
    montant: string;
    mois?: number;
  }>;
}): Promise<FiscalesModePage> {
  return requeteApi(`${BASE}/mode`, {
    method: "PUT",
    body: JSON.stringify(donnees),
  });
}

// ── Appariement transferts ↔ prises en charge (SPEC §5.3) ────────────

export type OpFiscaleIg = {
  id: number | null;
  d_cpta: string | null;
  n_regl: string | null;
  n_mattir: string | null;
  l_tiers: string | null;
  c_it: string | null;
  c_nat: string | null;
  c_nop: string | null;
  m_regl: string | null;
};

export type LigneAppariementFiscal = OpFiscaleIg & {
  petrole: boolean;
  pec: OpFiscaleIg | null;
  code_rf: string | null;
  motif: string;
  candidats?: OpFiscaleIg[];
};

export type FiscalesAppariementPage = {
  periode: { id: number; exercice_annee: number; mois: number } | null;
  lot: unknown;
  apparies: LigneAppariementFiscal[];
  ambigus: LigneAppariementFiscal[];
  non_apparies: LigneAppariementFiscal[];
  pec_orphelines?: OpFiscaleIg[];
  stats: {
    nb_ops_lot: number;
    nb_retenues: number;
    nb_transferts: number;
    nb_pec: number;
    nb_apparies: number;
    nb_ambigus: number;
    nb_non_apparies: number;
    nb_pec_orphelines: number;
  };
  message: string | null;
};

export function obtenirFiscalesAppariement(
  periodeId?: number,
): Promise<FiscalesAppariementPage> {
  const q = periodeId != null ? `?periode_id=${periodeId}` : "";
  return requeteApi(`${BASE}/appariement${q}`);
}
