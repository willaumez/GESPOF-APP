// Modèle cible : grille PLAN_TITRES — tirages/remboursements BTA·OTA (Tirages l.48-51) ;
// ligne calculée Tirages nets BTA ; remboursements : source à confirmer.
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
  { id: "tb", libelle: "Tirages BTA" },
  { id: "to", libelle: "Tirages OTA" },
  { id: "rb", libelle: "Remboursements BTA" },
  { id: "ro", libelle: "Remboursements OTA" },
  { id: "nb", libelle: "Tirages nets BTA", niveau: 0, calculable: true },
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
      const res = await obtenirGrille(ex, "PLAN_TITRES");
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
      const tb = rows.find((r) => r.id === "tb");
      const rb = rows.find((r) => r.id === "rb");
      const nets = Array.from({ length: 12 }, (_, i) =>
        (tb?.mois[i] || 0) - (rb?.mois[i] || 0),
      );
      const avecNets = rows.map((r) =>
        r.id === "nb" || r.calculable ? { ...r, mois: nets } : r,
      );
      const res = await enregistrerGrille(annee, "PLAN_TITRES", {
        unite_saisie: "MILLIONS",
        lignes: lignesVersApi(avecNets),
      });
      setLignes(grilleApiVersLignes(res.grille));
      toast.success("Programme titres enregistré.");
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="rounded-[10px] border border-amber-200 bg-amber-50 px-3 py-2 text-[12.5px] text-amber-900">
        Remboursements : source à confirmer (le manuel ne cite que les tirages).
        Référence 2025 (millions) : 1 106 000 ; 1 524 000 ; 711 124 ; 783 131,1 ;
        nets BTA 394 876.
      </p>
      <SofGrilleMensuellePage
        key={annee ?? "x"}
        config={{
          titre: "Programme d'émission des titres",
          description:
            "Prévisions mensuelles de tirages et remboursements BTA / OTA.",
          remplace: "SMC · F12 grille PLAN_TITRES",
          importLabel: "Importer",
          lignes,
          chargement: chargementEx || chargement || annee == null,
          enCours,
          onEnregistrer,
          onImporter: () =>
            toast.message("Import Excel Tirages (lignes 48–52) — à brancher."),
        }}
      />
    </div>
  );
}
