import { SofGrilleMensuellePage } from "@/portails/Sof/components/SofGrilleMensuellePage";

export default function Page() {
  return (
    <SofGrilleMensuellePage
      config={{
        titre: "Solde, MONP et pensions",
        description: "États liquidatifs et déversements IG, avec l'écart.",
        remplace: "États liquidatifs",
        importLabel: "Importer",
        lignes: [
    { id: "p1", libelle: "Solde permanente (brut)", mois: [0,0,0,0,0,0,0,0,0,0,0,0] },
    { id: "p2", libelle: "Solde permanente (net)", mois: [0,0,0,0,0,0,0,0,0,0,0,0] },
    { id: "p3", libelle: "MONP (brut)", mois: [0,0,0,0,0,0,0,0,0,0,0,0] },
    { id: "p4", libelle: "MONP (net)", mois: [0,0,0,0,0,0,0,0,0,0,0,0] },
    { id: "p5", libelle: "Pension (brut)", mois: [0,0,0,0,0,0,0,0,0,0,0,0] },
    { id: "p6", libelle: "Pension (net)", mois: [0,0,0,0,0,0,0,0,0,0,0,0] },
        ],
      }}
    />
  );
}
