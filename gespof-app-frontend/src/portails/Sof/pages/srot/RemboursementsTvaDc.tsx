import { ExtractionOraclePage } from "@/portails/Sof/components/extraction-oracle/ExtractionOraclePage";
import { extraireRemboursementsTvaDc } from "@/portails/Sof/api/tva";
import { formatMontant } from "@/shared/lib/format";
import type { LigneRemboursementTvaDc } from "@/portails/Sof/types/tva.interface";

export default function RemboursementsTvaDc() {
  return (
    <ExtractionOraclePage<LigneRemboursementTvaDc>
      navId="sof-srot-tva-remboursements-dc"
      description="Remboursements de TVA de l’exercice (DC) — compte 4781-31 / nature 81."
      titreCarte="Remboursements TVA (DC)"
      champTotal="Total réglé"
      extraire={extraireRemboursementsTvaDc}
      cleLigne={(l, i) => `${l.n_emis}-${l.n_regl}-${i}`}
      colonnes={[
        { cle: "d_regl", libelle: "Dat. régl.", largeur: "w-28", valeur: (l) => l.d_regl },
        { cle: "d_emis", libelle: "Dat. émis", largeur: "w-28", valeur: (l) => l.d_emis },
        { cle: "n_emis", libelle: "N° émis", largeur: "w-24", valeur: (l) => l.n_emis },
        { cle: "n_regl", libelle: "N° régl.", largeur: "w-24", valeur: (l) => l.n_regl },
        { cle: "c_pc", libelle: "PC", largeur: "w-16", valeur: (l) => l.c_pc },
        { cle: "l_pc", libelle: "Lib. PC", valeur: (l) => l.l_pc },
        { cle: "nom", libelle: "Bénéficiaire", valeur: (l) => l.nom },
        { cle: "n_mattir", libelle: "Matricule", largeur: "w-28", valeur: (l) => l.n_mattir },
        { cle: "l_ref1", libelle: "Réf. 1", valeur: (l) => l.l_ref1 },
        { cle: "c_mdr", libelle: "Mdr", largeur: "w-16", valeur: (l) => l.c_mdr },
        { cle: "c_banque", libelle: "Banque", largeur: "w-20", valeur: (l) => l.c_banque },
        {
          cle: "m_regl",
          libelle: "Montant",
          largeur: "w-36",
          alignement: "right",
          montant: true,
          valeur: (l) => l.m_regl,
        },
        {
          cle: "m_net",
          libelle: "Net",
          largeur: "w-32",
          alignement: "right",
          valeur: (l) => formatMontant(l.m_net),
        },
      ]}
    />
  );
}
