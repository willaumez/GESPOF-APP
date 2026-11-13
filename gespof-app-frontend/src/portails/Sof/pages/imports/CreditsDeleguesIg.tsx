import {
  ImportExtractionPage,
  type ConfigImportExtraction,
} from "@/portails/Sof/components/imports/ImportExtractionPage";
import {
  COLS_VIDR,
  celluleVidr,
  estMontantVidr,
  estMonoVidr,
  type LigneIgOperationVidr,
} from "@/portails/Sof/components/imports/ig-vidr";
import {
  importerExcelIgCreditsDelegues,
  importerOracleIgCreditsDelegues,
  obtenirEtatIgCreditsDelegues,
} from "@/portails/Sof/api/ig-credits-delegues";

const CONFIG: ConfigImportExtraction<LigneIgOperationVidr> = {
  titre: "Crédits délégués",
  description:
    "Source IG. Chaque import validé remplace le lot précédent de la même période pour la source 4742-.",
  remplace: "VIDR 4742-* → Crédits délégués IG.xlsx",
  requeteOracle: "VIDR · Crédits délégués",
  filtres: [
    ["Sens", "Dépenses"],
    ["Mode", "Numéraire et bancaire"],
    ["Compte", "4742-"],
  ],
  colonnes: COLS_VIDR,
  controles: [
    "Colonnes VIDR.",
    "Rejet des lignes dont le compte ne commence pas par 4742-.",
    "Préfixe C_REF1 conservé pour distinguer exercice courant et arriérés.",
  ],
  libelleMontant: "Montant total",
  messageVide: "Aucune ligne importée (filtre compte 4742-).",
  client: {
    obtenirEtat: obtenirEtatIgCreditsDelegues,
    importerOracle: importerOracleIgCreditsDelegues,
    importerExcel: importerExcelIgCreditsDelegues,
  },
  cellule: celluleVidr,
  estMontant: estMontantVidr,
  estMono: estMonoVidr,
  largeurMin: 1820,
};

export default function CreditsDeleguesIg() {
  return <ImportExtractionPage config={CONFIG} />;
}
