import { SofGrilleMensuellePage } from "@/portails/Sof/components/SofGrilleMensuellePage";

export default function Page() {
  return (
    <SofGrilleMensuellePage
      config={{
        titre: "Facilités et agios",
        description: "Import SCR, complété à la main.",
        remplace: "Principal facilités / Agios",
        importLabel: "Importer",
        lignes: [
    { id: "f1", libelle: "Tirages facilités", mois: [0,0,0,0,0,0,0,0,0,0,0,0] },
    { id: "f2", libelle: "Remboursements facilités", mois: [0,0,0,0,0,0,0,0,0,0,0,0] },
    { id: "f3", libelle: "Agios et intérêts", mois: [0,0,0,0,0,0,0,0,0,0,0,0] },
        ],
      }}
    />
  );
}
