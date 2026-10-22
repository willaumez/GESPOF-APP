import {
  COLONNES_OPERATION_DOPE,
  ExtractionOraclePage,
} from "@/portails/Sof/components/extraction-oracle/ExtractionOraclePage";
import { extraireRemboursementsTvaIg } from "@/portails/Sof/api/tva";
import type { LigneOperationDope } from "@/portails/Sof/types/depenses.interface";

export default function RemboursementsTvaIg() {
  return (
    <ExtractionOraclePage<LigneOperationDope>
      navId="sof-srot-tva-remboursements-ig"
      description="Règlements TVA-IG — compte 4781-31 / nature 81."
      titreCarte="Remboursements TVA (IG)"
      extraire={extraireRemboursementsTvaIg}
      cleLigne={(l, i) => `${l.c_pca}-${l.n_op}-${l.n_regl}-${l.n_lig_r}-${i}`}
      colonnes={COLONNES_OPERATION_DOPE}
    />
  );
}
