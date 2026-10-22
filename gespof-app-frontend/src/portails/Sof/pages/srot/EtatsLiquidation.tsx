import { ExtractionOraclePage } from "@/portails/Sof/components/extraction-oracle/ExtractionOraclePage";
import { extraireEtatsLiquidation } from "@/portails/Sof/api/depenses";
import { formatMontant } from "@/shared/lib/format";
import type { LigneEtatLiquidation } from "@/portails/Sof/types/depenses.interface";

export default function EtatsLiquidation() {
  return (
    <ExtractionOraclePage<LigneEtatLiquidation>
      navId="sof-srot-depenses-etats-liquidation"
      description="États de liquidation des dépenses (déversements IG — SOLDE ETAT / PENSIONS)."
      titreCarte="États de liquidation"
      champTotal="Total net"
      extraire={extraireEtatsLiquidation}
      cleLigne={(l, i) => `${l.c_dev}-${l.d_dev}-${l.l_dev}-${i}`}
      colonnes={[
        { cle: "d_dev", libelle: "Date dév.", largeur: "w-28", valeur: (l) => l.d_dev },
        { cle: "c_dev", libelle: "Devise", largeur: "w-20", valeur: (l) => l.c_dev },
        { cle: "l_dev", libelle: "Libellé", valeur: (l) => l.l_dev },
        { cle: "d_valeur", libelle: "Date valeur", largeur: "w-28", valeur: (l) => l.d_valeur },
        { cle: "nombre", libelle: "Nombre", largeur: "w-20", alignement: "right", valeur: (l) => l.nombre },
        {
          cle: "m_brut",
          libelle: "Brut",
          largeur: "w-32",
          alignement: "right",
          valeur: (l) => formatMontant(l.m_brut),
        },
        {
          cle: "m_net",
          libelle: "Net",
          largeur: "w-32",
          alignement: "right",
          valeur: (l) => l.m_net,
          montant: true,
        },
        { cle: "d_valid", libelle: "Validé le", largeur: "w-28", valeur: (l) => l.d_valid },
      ]}
    />
  );
}
