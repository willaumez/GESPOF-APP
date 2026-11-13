import { dateFr } from "@/portails/Sof/components/SofCards";
import { formatMontant } from "@/shared/lib/format";

export interface LigneIgOperationVidr {
  id: number;
  c_pca: string | null;
  d_cpta: string | null;
  n_regl: string | null;
  n_lig_r: number | string | null;
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

export const COLS_VIDR = [
  "C_PCA",
  "D_CPTA",
  "N_REGL",
  "N_LIG_R",
  "C_TYP_OP",
  "N_OP",
  "C_GUIC",
  "N_MATTIR",
  "L_NP",
  "C_OPE",
  "C_IT",
  "C_NAT",
  "C_REF1",
  "C_REF2",
  "M_REGL",
  "C_NOP",
  "C_MDR",
  "N_CHEQ",
  "C_CAIS",
  "L_TIERS",
] as const;

export function celluleVidr(
  col: string,
  ligne: LigneIgOperationVidr,
): string {
  switch (col) {
    case "C_PCA":
      return ligne.c_pca ?? "—";
    case "D_CPTA":
      return dateFr(ligne.d_cpta);
    case "N_REGL":
      return ligne.n_regl ?? "—";
    case "N_LIG_R":
      return ligne.n_lig_r != null ? String(ligne.n_lig_r) : "—";
    case "C_TYP_OP":
      return ligne.c_typ_op ?? "—";
    case "N_OP":
      return ligne.n_op ?? "—";
    case "C_GUIC":
      return ligne.c_guic ?? "—";
    case "N_MATTIR":
      return ligne.n_mattir ?? "—";
    case "L_NP":
      return ligne.l_np ?? "—";
    case "C_OPE":
      return ligne.c_ope ?? "—";
    case "C_IT":
      return ligne.c_it ?? "—";
    case "C_NAT":
      return ligne.c_nat ?? "—";
    case "C_REF1":
      return ligne.c_ref1 ?? "—";
    case "C_REF2":
      return ligne.c_ref2 ?? "—";
    case "M_REGL":
      return formatMontant(ligne.m_regl);
    case "C_NOP":
      return ligne.c_nop ?? "—";
    case "C_MDR":
      return ligne.c_mdr ?? "—";
    case "N_CHEQ":
      return ligne.n_cheq ?? "—";
    case "C_CAIS":
      return ligne.c_cais ?? "—";
    case "L_TIERS":
      return ligne.l_tiers ?? "—";
    default:
      return "—";
  }
}

export function estMontantVidr(col: string): boolean {
  return col === "M_REGL";
}

export function estMonoVidr(col: string): boolean {
  return col !== "L_NP" && col !== "L_TIERS";
}
