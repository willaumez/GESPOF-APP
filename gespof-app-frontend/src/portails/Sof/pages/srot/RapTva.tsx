import { ExtractionOraclePage } from "@/portails/Sof/components/extraction-oracle/ExtractionOraclePage";
import { extraireRapTva } from "@/portails/Sof/api/tva";
import type { LigneRapTva } from "@/portails/Sof/types/tva.interface";

export default function RapTva() {
  return (
    <ExtractionOraclePage<LigneRapTva>
      navId="sof-srot-tva-rap"
      description="Restes à payer TVA — compte 4781-31 / nature 81."
      titreCarte="RAP TVA (4781-31)"
      champTotal="Total RAP"
      extraire={extraireRapTva}
      cleLigne={(l, i) => `${l.n_emis}-${l.orig}-${l.rap}-${i}`}
      colonnes={[
        { cle: "d_emis", libelle: "Date émis", largeur: "w-28", valeur: (l) => l.d_emis },
        { cle: "n_emis", libelle: "N° émis", largeur: "w-24", valeur: (l) => l.n_emis },
        { cle: "orig", libelle: "Orig.", largeur: "w-16", valeur: (l) => l.orig },
        { cle: "c_pc", libelle: "PC", largeur: "w-16", valeur: (l) => l.c_pc },
        { cle: "l_pc", libelle: "Lib. PC", valeur: (l) => l.l_pc },
        { cle: "nom", libelle: "Bénéficiaire", valeur: (l) => l.nom },
        { cle: "n_mattir", libelle: "Matricule", largeur: "w-28", valeur: (l) => l.n_mattir },
        { cle: "objet", libelle: "Objet", valeur: (l) => l.objet },
        { cle: "ref", libelle: "Réf.", valeur: (l) => l.ref },
        { cle: "c_mdr", libelle: "Mdr", largeur: "w-16", valeur: (l) => l.c_mdr },
        {
          cle: "rap",
          libelle: "RAP",
          largeur: "w-36",
          alignement: "right",
          montant: true,
          valeur: (l) => l.rap,
        },
        { cle: "c_blocag", libelle: "Blocage", largeur: "w-20", valeur: (l) => l.c_blocag },
      ]}
    />
  );
}
