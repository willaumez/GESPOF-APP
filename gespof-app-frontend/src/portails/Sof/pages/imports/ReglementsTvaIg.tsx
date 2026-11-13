import {
  ImportExtractionPage,
  type ConfigImportExtraction,
} from "@/portails/Sof/components/imports/ImportExtractionPage";
import {
  importerExcelIgReglementsTva,
  importerOracleIgReglementsTva,
  obtenirEtatIgReglementsTva,
  type LigneIgReglementTva,
} from "@/portails/Sof/api/ig-reglements-tva";
import { dateFr } from "@/portails/Sof/components/SofCards";
import { formatMontant } from "@/shared/lib/format";

/** Colonnes VIDR (maquette sof-data.js). */
const COLS = [
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
] as const;

function cellule(col: string, l: LigneIgReglementTva): string {
  switch (col) {
    case "C_PCA":
      return l.c_pca ?? "—";
    case "D_CPTA":
      return dateFr(l.d_cpta);
    case "N_REGL":
      return l.n_regl ?? "—";
    case "N_LIG_R":
      return l.n_lig_r ?? "—";
    case "C_TYP_OP":
      return l.c_typ_op ?? "—";
    case "N_OP":
      return l.n_op ?? "—";
    case "C_GUIC":
      return l.c_guic ?? "—";
    case "N_MATTIR":
      return l.n_mattir ?? "—";
    case "L_NP":
      return l.l_np ?? "—";
    case "C_OPE":
      return l.c_ope ?? "—";
    case "C_IT":
      return l.c_it ?? "—";
    case "C_NAT":
      return l.c_nat ?? "—";
    case "C_REF1":
      return l.c_ref1 ?? "—";
    case "C_REF2":
      return l.c_ref2 ?? "—";
    case "M_REGL":
      return formatMontant(l.m_regl);
    case "C_NOP":
      return l.c_nop ?? "—";
    case "C_MDR":
      return l.c_mdr ?? "—";
    case "N_CHEQ":
      return l.n_cheq ?? "—";
    case "C_CAIS":
      return l.c_cais ?? "—";
    default:
      return "—";
  }
}

const CONFIG: ConfigImportExtraction<LigneIgReglementTva> = {
  titre: "Règlements TVA",
  description:
    "Source IG. L'import validé remplace le lot précédent de la même source et de la même période.",
  remplace: "VIDR 4781-31/81 → TVA IG.xlsx",
  requeteOracle: "VIDR · Règlements TVA",
  filtres: [
    ["Compte", "4781-31"],
    ["Nature", "81"],
  ],
  colonnes: COLS,
  controles: ["Colonnes VIDR"],
  libelleMontant: "Montant total",
  messageVide: "Aucune ligne importée (filtre compte / nature).",
  client: {
    obtenirEtat: obtenirEtatIgReglementsTva,
    importerOracle: importerOracleIgReglementsTva,
    importerExcel: importerExcelIgReglementsTva,
  },
  cellule,
  estMontant: (c) => c === "M_REGL",
  estMono: (c) => c !== "L_NP",
  largeurMin: 1600,
};

export default function ReglementsTvaIg() {
  return <ImportExtractionPage config={CONFIG} />;
}
