import { useEffect, useState } from "react";
import { toast } from "sonner";
import { obtenirExerciceCourant } from "@/portails/Sof/api/referentiel";

/** Année de l'exercice SOF courant (ou null si aucun / chargement). */
export function useExerciceAnneeCourante(): {
  annee: number | null;
  chargement: boolean;
} {
  const [annee, setAnnee] = useState<number | null>(null);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    let actif = true;
    setChargement(true);
    obtenirExerciceCourant()
      .then((res) => {
        if (!actif) return;
        setAnnee(res.exercice?.annee ?? null);
      })
      .catch((e) => {
        if (!actif) return;
        toast.error(
          e instanceof Error ? e.message : "Impossible de charger l'exercice.",
        );
        setAnnee(null);
      })
      .finally(() => {
        if (actif) setChargement(false);
      });
    return () => {
      actif = false;
    };
  }, []);

  return { annee, chargement };
}
