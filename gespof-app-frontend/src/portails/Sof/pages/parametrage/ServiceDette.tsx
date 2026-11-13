// Modèle cible : grille PLAN_DETTE — 4 lignes RD Synthèse › Tirages l.54-58
// (principal/intérêts × intérieur/extérieur) + ligne calculée « Service prévisionnel DGD ».
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  SofGrilleMensuellePage,
  type LigneGrilleMensuelle,
} from "@/portails/Sof/components/SofGrilleMensuellePage";
import {
  enregistrerGrille,
  obtenirGrille,
} from "@/portails/Sof/api/parametrage";
import { useExerciceAnneeCourante } from "@/portails/Sof/hooks/useExerciceAnneeCourante";
import {
  grilleApiVersLignes,
  lignesVersApi,
  modeleVersLignes,
} from "@/portails/Sof/lib/grille-mensuelle";

const MODELE = [
  { id: "pi", libelle: "Principal dette intérieure" },
  { id: "pe", libelle: "Principal dette extérieure" },
  { id: "ii", libelle: "Intérêts dette intérieure" },
  { id: "ie", libelle: "Intérêts dette extérieure" },
  {
    id: "tot",
    libelle: "Service prévisionnel DGD",
    niveau: 0,
    calculable: true,
  },
];

export default function Page() {
  const { annee, chargement: chargementEx } = useExerciceAnneeCourante();
  const [lignes, setLignes] = useState<LigneGrilleMensuelle[]>(() =>
    modeleVersLignes(MODELE),
  );
  const [chargement, setChargement] = useState(false);
  const [enCours, setEnCours] = useState(false);

  const charger = useCallback(async (ex: number) => {
    setChargement(true);
    try {
      const res = await obtenirGrille(ex, "PLAN_DETTE");
      if (res.grille.lignes.length > 0) {
        setLignes(grilleApiVersLignes(res.grille));
      } else {
        setLignes(modeleVersLignes(MODELE));
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Chargement impossible.");
      setLignes(modeleVersLignes(MODELE));
    } finally {
      setChargement(false);
    }
  }, []);

  useEffect(() => {
    if (annee == null) return;
    void charger(annee);
  }, [annee, charger]);

  async function onEnregistrer(rows: LigneGrilleMensuelle[]) {
    if (annee == null) return;
    setEnCours(true);
    try {
      const saisies = rows.filter((r) => !r.calculable);
      const totaux = Array.from({ length: 12 }, (_, i) =>
        saisies.reduce((s, r) => s + (r.mois[i] || 0), 0),
      );
      const avecTotal = rows.map((r) =>
        r.id === "tot" || r.calculable ? { ...r, mois: totaux } : r,
      );
      const res = await enregistrerGrille(annee, "PLAN_DETTE", {
        unite_saisie: "MILLIONS",
        lignes: lignesVersApi(avecTotal),
      });
      setLignes(grilleApiVersLignes(res.grille));
      toast.success("Service de la dette enregistré.");
    } finally {
      setEnCours(false);
    }
  }

  return (
    <SofGrilleMensuellePage
      key={annee ?? "x"}
      config={{
        titre: "Service de la dette (DGD)",
        description:
          "Prévisions mensuelles du service de la dette. Total de référence 2025 : 3 257 360,6 millions.",
        remplace: "RD Synthèse › Tirages · F12 grille PLAN_DETTE",
        importLabel: "Importer",
        lignes,
        chargement: chargementEx || chargement || annee == null,
        enCours,
        onEnregistrer,
        onImporter: () =>
          toast.message("Import Excel Tirages (lignes 54–58) — à brancher."),
      }}
    />
  );
}
