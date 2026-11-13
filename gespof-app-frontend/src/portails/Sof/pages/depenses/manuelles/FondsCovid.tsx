import { SofGrilleMensuellePage } from "@/portails/Sof/components/SofGrilleMensuellePage";

export default function Page() {
  return (
    <SofGrilleMensuellePage
      config={{
        titre: "Fonds COVID-19",
        description: "Import des fonds, complété à la main.",
        remplace: "« Riposte », « Solidarité »",
        importLabel: "Importer",
        lignes: [
    { id: "c1", libelle: "Riposte · Ressources", mois: [0,0,0,0,0,0,0,0,0,0,0,0] },
    { id: "c2", libelle: "Riposte · Emplois", mois: [0,0,0,0,0,0,0,0,0,0,0,0] },
    { id: "c3", libelle: "Solidarité · Ressources", mois: [0,0,0,0,0,0,0,0,0,0,0,0] },
    { id: "c4", libelle: "Solidarité · Emplois", mois: [0,0,0,0,0,0,0,0,0,0,0,0] },
        ],
      }}
    />
  );
}
