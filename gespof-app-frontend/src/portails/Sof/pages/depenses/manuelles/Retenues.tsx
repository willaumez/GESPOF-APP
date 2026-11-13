import { SofGrilleMensuellePage } from "@/portails/Sof/components/SofGrilleMensuellePage";

export default function Page() {
  return (
    <SofGrilleMensuellePage
      config={{
        titre: "Retenues pension et CNAMGS",
        description: "Fiches de comptes CAS Pensions et CNAMGS.",
        remplace: "Fiches de comptes",
        importLabel: "Importer",
        lignes: [
    { id: "r1", libelle: "7251-1 · CAS Pensions", mois: [0,0,0,0,0,0,0,0,0,0,0,0] },
    { id: "r2", libelle: "7251-2 · CAS Pensions", mois: [0,0,0,0,0,0,0,0,0,0,0,0] },
    { id: "r3", libelle: "7251-3 · CAS Pensions", mois: [0,0,0,0,0,0,0,0,0,0,0,0] },
    { id: "r4", libelle: "4663-317 · CNAMGS", mois: [0,0,0,0,0,0,0,0,0,0,0,0] },
        ],
      }}
    />
  );
}
