import { ExtractionOraclePage } from "@/portails/Sof/components/extraction-oracle/ExtractionOraclePage";
import { extraireReglements } from "@/portails/Sof/api/depenses";
import { formatMontant } from "@/shared/lib/format";
import type { LigneReglementExercice } from "@/portails/Sof/types/depenses.interface";

export default function ReglementsOrdonnances() {
  return (
    <ExtractionOraclePage<LigneReglementExercice>
      navId="sof-srot-depenses-reglements"
      description="Règlements de l’exercice — ordonnances d’origine budgétaire (B)."
      titreCarte="Règlements (ordonnances)"
      champTotal="Total réglé"
      extraire={extraireReglements}
      cleLigne={(l, i) => `${l.n_ordo}-${l.n_regl}-${i}`}
      colonnes={[
        { cle: "d_regl", libelle: "Dat. régl.", largeur: "w-28", valeur: (l) => l.d_regl },
        { cle: "d_emis", libelle: "Dat. émis", largeur: "w-28", valeur: (l) => l.d_emis },
        { cle: "n_ordo", libelle: "N° ordo", largeur: "w-24", valeur: (l) => l.n_ordo },
        { cle: "n_regl", libelle: "N° régl.", largeur: "w-24", valeur: (l) => l.n_regl },
        { cle: "matricule", libelle: "Matricule", largeur: "w-28", valeur: (l) => l.matricule },
        { cle: "nom", libelle: "Bénéficiaire", valeur: (l) => l.nom_beneficiaire },
        { cle: "objet", libelle: "Objet", valeur: (l) => l.objet },
        { cle: "titr", libelle: "Titr", largeur: "w-16", valeur: (l) => l.titr },
        { cle: "pc", libelle: "PC", largeur: "w-16", valeur: (l) => l.pc },
        { cle: "categ", libelle: "Catég.", largeur: "w-16", valeur: (l) => l.categ },
        { cle: "c_mdr", libelle: "Mdr", largeur: "w-16", valeur: (l) => l.c_mdr },
        {
          cle: "montant_regle",
          libelle: "Montant réglé",
          largeur: "w-36",
          alignement: "right",
          montant: true,
          valeur: (l) => l.montant_regle,
        },
        {
          cle: "montant_net",
          libelle: "Net",
          largeur: "w-32",
          alignement: "right",
          valeur: (l) => formatMontant(l.montant_net),
        },
      ]}
    />
  );
}
