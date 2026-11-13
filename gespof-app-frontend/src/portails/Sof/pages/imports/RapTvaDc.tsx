import {
  ImportExtractionPage,
  type ConfigImportExtraction,
} from "@/portails/Sof/components/imports/ImportExtractionPage";
import {
  importerExcelDcRapTva,
  importerOracleDcRapTva,
  obtenirEtatDcRapTva,
  type LigneDcRapTva,
} from "@/portails/Sof/api/dc-rap-tva";
import { dateFr } from "@/portails/Sof/components/SofCards";
import { formatMontant } from "@/shared/lib/format";

/** Colonnes aperçu maquette sof-data.js dc-rap-tva. */
const COLS = [
  "PC",
  "MANDAT",
  "D_EMIS",
  "MDR",
  "MATRIC",
  "NOM",
  "RAP",
  "D_VISA",
  "OBJET",
  "C_BLOCAG",
] as const;

const MONO_COLS = new Set<string>([
  "PC",
  "MANDAT",
  "D_EMIS",
  "MDR",
  "MATRIC",
  "RAP",
  "D_VISA",
  "C_BLOCAG",
]);

function cellule(col: string, l: LigneDcRapTva): string {
  switch (col) {
    case "PC":
      return l.pc ?? "—";
    case "MANDAT":
      return l.mandat ?? l.n_emis ?? "—";
    case "D_EMIS":
      return dateFr(l.d_emis);
    case "MDR":
      return l.mdr ?? "—";
    case "MATRIC":
      return l.matric ?? "—";
    case "NOM":
      return l.nom ?? "—";
    case "RAP":
      return formatMontant(l.rap);
    case "D_VISA":
      return dateFr(l.d_visa);
    case "OBJET":
      return l.objet ?? "—";
    case "C_BLOCAG":
      return l.c_blocag ?? "—";
    default:
      return "—";
  }
}

const CONFIG: ConfigImportExtraction<LigneDcRapTva> = {
  titre: "RAP TVA",
  description:
    "Source DC. L'import validé remplace le lot précédent de la même source et de la même période.",
  remplace: "XRAM 4781-31/81 → RAP TVA DC.xlsx",
  requeteOracle: "XRAM · RAP TVA",
  filtres: [
    ["Compte", "4781-31"],
    ["Nature", "81"],
  ],
  colonnes: COLS,
  controles: ["Compte ou nature différents rejetés"],
  libelleMontant: "RAP total",
  messageVide: "Aucune ligne importée (filtre compte / nature).",
  client: {
    obtenirEtat: obtenirEtatDcRapTva,
    importerOracle: importerOracleDcRapTva,
    importerExcel: importerExcelDcRapTva,
  },
  cellule,
  estMontant: (c) => c === "RAP",
  estMono: (c) => MONO_COLS.has(c),
  largeurMin: 1040,
};

export default function RapTvaDc() {
  return <ImportExtractionPage config={CONFIG} />;
}
