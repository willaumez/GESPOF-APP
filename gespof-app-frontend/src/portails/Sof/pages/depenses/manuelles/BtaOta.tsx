import { SofGrilleMensuellePage } from "@/portails/Sof/components/SofGrilleMensuellePage";

export default function Page() {
  return (
    <SofGrilleMensuellePage
      config={{
        titre: "BTA / OTA",
        description: "Import SMC, complété à la main.",
        remplace: "« Récap BTA OTA »",
        importLabel: "Importer",
        lignes: [
    { id: "b1", libelle: "Émissions BTA", mois: [0,0,0,0,0,0,0,0,0,0,0,0] },
    { id: "b2", libelle: "Émissions OTA", mois: [0,0,0,0,0,0,0,0,0,0,0,0] },
    { id: "b3", libelle: "Remboursements", mois: [0,0,0,0,0,0,0,0,0,0,0,0] },
    { id: "b4", libelle: "Intérêts précomptés", mois: [0,0,0,0,0,0,0,0,0,0,0,0] },
    { id: "b5", libelle: "Intérêts courus", mois: [0,0,0,0,0,0,0,0,0,0,0,0] },
        ],
      }}
    />
  );
}
