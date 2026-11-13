import { SofGrilleMensuellePage } from "@/portails/Sof/components/SofGrilleMensuellePage";

export default function Page() {
  return (
    <SofGrilleMensuellePage
      config={{
        titre: "Imputations",
        description: "Calculées depuis les grilles manuelles (pages Dette à Retenues).",
        remplace: "« Imputations Dépenses »",
        importLabel: "Importer",
        lignes: [
    { id: "i1", code: "D1A", libelle: "Dette publique", mois: [0,0,0,0,0,0,0,0,0,0,0,0] },
    { id: "i2", code: "D2A", libelle: "BTA / OTA", mois: [0,0,0,0,0,0,0,0,0,0,0,0] },
    { id: "i3", code: "D2A", libelle: "Facilités et agios", mois: [0,0,0,0,0,0,0,0,0,0,0,0] },
    { id: "i4", code: "D2D", libelle: "Fonds COVID-19", mois: [0,0,0,0,0,0,0,0,0,0,0,0] },
    { id: "i5", code: "D2B", libelle: "Personnel", mois: [0,0,0,0,0,0,0,0,0,0,0,0] },
    { id: "i6", code: "D2B", libelle: "Retenues", mois: [0,0,0,0,0,0,0,0,0,0,0,0] },
        ],
      }}
    />
  );
}
