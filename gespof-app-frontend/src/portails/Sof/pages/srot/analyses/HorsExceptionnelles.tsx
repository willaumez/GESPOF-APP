import { SofEtatTablePage } from "@/portails/Sof/components/SofEtatTablePage";

export default function Page() {
  return (
    <SofEtatTablePage
      config={{
        titre: "Hors recettes exceptionnelles",
        description: "Analyse SROT · Hors recettes exceptionnelles. Lecture seule.",
        remplace: "RD Synthèse Analyse",
        colonnes: [
          { key: "libelle", label: "Ligne" },
          { key: "n", label: "N", align: "r", montant: true },
          { key: "n1", label: "N-1", align: "r", montant: true },
          { key: "ecart", label: "Écart", align: "r", montant: true },
        ],
        lignes: [],
        sousTitre: "En attente du calcul SROT (phase 5)",
      }}
    />
  );
}
