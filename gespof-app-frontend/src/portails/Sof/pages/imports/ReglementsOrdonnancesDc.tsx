import {
  ImportExtractionPage,
  type ConfigImportExtraction,
} from "@/portails/Sof/components/imports/ImportExtractionPage";
import {
  importerExcelDcReglementsOrdonnances,
  importerOracleDcReglementsOrdonnances,
  obtenirEtatDcReglementsOrdonnances,
  type LigneDcReglementOrdonnance,
} from "@/portails/Sof/api/dc-reglements-ordonnances";
import { dateFr } from "@/portails/Sof/components/SofCards";
import { formatMontant } from "@/shared/lib/format";

const COLS_APERCU = [
  "TYPE",
  "TYPE_1",
  "CATEG",
  "EX",
  "DAT_REGL",
  "ORDONNANCE",
  "N_REGL",
  "D_EMIS",
  "MIN",
  "MISSION",
  "PROG",
  "TITRE",
  "BOP",
  "UO",
  "PC",
  "NAT",
  "MDR",
  "M_REGL",
  "M_NET",
] as const;

const COLS_F2 = [
  "TYPE",
  "TYPE_1",
  "CATEG",
  "EX",
  "DAT_REGL",
  "ORDONNANCE",
  "N_REGL",
  "D_EMIS",
  "MIN",
  "L_MIN",
  "MISSION",
  "L_MIS",
  "PROG",
  "ACTION",
  "TITRE",
  "BOP",
  "L_BOP",
  "UO",
  "L_UO",
  "PC",
  "LIB_PC",
  "L_PROG",
  "NAT",
  "NATURE",
  "BANQUE",
  "MDR",
  "COMPTE_BANC",
  "MATRIC",
  "NOM",
  "M_REGL",
  "M_NET",
  "M_PREC_TVA",
  "N_MANDAT_TVA",
  "OBJET",
  "NUM_BV",
  "N_CBANQ",
  "D_ECHE",
] as const;

const MONO_COLS = new Set<string>([
  "TYPE",
  "TYPE_1",
  "CATEG",
  "EX",
  "DAT_REGL",
  "ORDONNANCE",
  "N_REGL",
  "D_EMIS",
  "MIN",
  "MISSION",
  "PROG",
  "TITRE",
  "BOP",
  "UO",
  "PC",
  "NAT",
  "MDR",
  "M_REGL",
  "M_NET",
]);

function cellule(col: string, ligne: LigneDcReglementOrdonnance): string {
  switch (col) {
    case "TYPE":
      return ligne.type ?? "—";
    case "TYPE_1":
      return ligne.type_1 ?? "—";
    case "CATEG":
      return ligne.categ ?? "—";
    case "EX":
      return ligne.ex ?? "—";
    case "DAT_REGL":
      return dateFr(ligne.dat_regl);
    case "ORDONNANCE":
      return ligne.ordonnance ?? "—";
    case "N_REGL":
      return ligne.n_regl ?? "—";
    case "D_EMIS":
      return dateFr(ligne.d_emis);
    case "MIN":
      return ligne.min ?? "—";
    case "MISSION":
      return ligne.mission ?? "—";
    case "PROG":
      return ligne.prog ?? "—";
    case "TITRE":
      return ligne.titre ?? "—";
    case "BOP":
      return ligne.bop ?? "—";
    case "UO":
      return ligne.uo ?? "—";
    case "PC":
      return ligne.pc ?? "—";
    case "NAT":
      return ligne.nat ?? "—";
    case "MDR":
      return ligne.mdr ?? "—";
    case "M_REGL":
      return formatMontant(ligne.m_regl);
    case "M_NET":
      return formatMontant(ligne.m_net);
    default:
      return "—";
  }
}

const CONFIG: ConfigImportExtraction<LigneDcReglementOrdonnance> = {
  titre: "Règlements sur ordonnances",
  description:
    "Source DC. L'import validé remplace le lot précédent de la même source et de la même période.",
  remplace: "XRGV → REGL.xlsx",
  requeteOracle: "XRGV · Règlements sur ordonnances",
  filtres: [],
  colonnes: COLS_APERCU,
  colonnesControle: COLS_F2,
  controles: [
    "Doublons sur le couple ORDONNANCE + N_REGL : la première occurrence est conservée, les suivantes passent en anomalie.",
  ],
  libelleMontant: "Montant réglé total",
  messageVide: "Aucune ligne importée sur la période sélectionnée.",
  labelDateDebut: "Début d'exercice",
  labelDateFin: "Fin de période",
  client: {
    obtenirEtat: obtenirEtatDcReglementsOrdonnances,
    importerOracle: importerOracleDcReglementsOrdonnances,
    importerExcel: importerExcelDcReglementsOrdonnances,
  },
  cellule,
  estMontant: (col) => col === "M_REGL" || col === "M_NET",
  estMono: (col) => MONO_COLS.has(col),
  largeurMin: 1560,
};

export default function ReglementsOrdonnancesDc() {
  return <ImportExtractionPage config={CONFIG} />;
}
