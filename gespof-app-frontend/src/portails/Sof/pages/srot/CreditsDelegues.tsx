import {
  COLONNES_OPERATION_DOPE,
  ExtractionOraclePage,
} from "@/portails/Sof/components/extraction-oracle/ExtractionOraclePage";
import { extraireCreditsDelegues } from "@/portails/Sof/api/depenses";
import type { LigneOperationDope } from "@/portails/Sof/types/depenses.interface";

export default function CreditsDelegues() {
  return (
    <ExtractionOraclePage<LigneOperationDope>
      navId="sof-srot-depenses-credits"
      description="Règlements sur crédits délégués — compte balance 4742-."
      titreCarte="Crédits délégués"
      extraire={extraireCreditsDelegues}
      cleLigne={(l, i) => `${l.c_pca}-${l.n_op}-${l.n_regl}-${l.n_lig_r}-${i}`}
      colonnes={COLONNES_OPERATION_DOPE}
    />
  );
}
