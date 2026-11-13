import { SofGrilleMensuellePage } from "@/portails/Sof/components/SofGrilleMensuellePage";

export default function Page() {
  return (
    <SofGrilleMensuellePage
      config={{
        titre: "Dette publique",
        description: "Import TDP, complété à la main.",
        remplace: "« Dette Brute »",
        importLabel: "Importer",
        lignes: [
    { id: "d1", libelle: "Principal · Intérieure", mois: [0,0,0,0,0,0,0,0,0,0,0,0] },
    { id: "d2", libelle: "Principal · Extérieure", mois: [0,0,0,0,0,0,0,0,0,0,0,0] },
    { id: "d3", libelle: "Intérêts · Intérieure", mois: [0,0,0,0,0,0,0,0,0,0,0,0] },
    { id: "d4", libelle: "Intérêts · Extérieure", mois: [0,0,0,0,0,0,0,0,0,0,0,0] },
        ],
      }}
    />
  );
}
