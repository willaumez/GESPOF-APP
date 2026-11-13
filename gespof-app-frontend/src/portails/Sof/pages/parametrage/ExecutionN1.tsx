// Modèle cible : montant_mensuel (exercice N-1, toutes rubriques recettes nomenclature) ;
// mensuel saisi, cumul calculé ; import RD Synthèse › Recettes Ex Ant P:AA (millions → FCFA).
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  SofGrilleMensuellePage,
  type LigneGrilleMensuelle,
} from "@/portails/Sof/components/SofGrilleMensuellePage";
import {
  enregistrerExecutionN1,
  obtenirExecutionN1,
} from "@/portails/Sof/api/parametrage";
import { listerRubriquesRecettes } from "@/portails/Sof/api/referentiel";
import type { RubriqueRecetteNoeud } from "@/portails/Sof/types/referentiel.interface";
import { useExerciceAnneeCourante } from "@/portails/Sof/hooks/useExerciceAnneeCourante";
import { moisVersNombres } from "@/portails/Sof/lib/grille-mensuelle";

function aplatir(
  noeuds: RubriqueRecetteNoeud[],
  acc: LigneGrilleMensuelle[] = [],
): LigneGrilleMensuelle[] {
  for (const n of noeuds) {
    acc.push({
      id: n.code,
      code: n.code,
      libelle: n.libelle,
      niveau: Math.max(0, (n.niveau ?? 1) - 1),
      mois: Array.from({ length: 12 }, () => 0),
    });
    if (n.enfants?.length) aplatir(n.enfants, acc);
  }
  return acc;
}

export default function Page() {
  const { annee, chargement: chargementEx } = useExerciceAnneeCourante();
  const [lignes, setLignes] = useState<LigneGrilleMensuelle[]>([]);
  const [chargement, setChargement] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [n1, setN1] = useState<number | null>(null);

  const charger = useCallback(async (ex: number) => {
    setChargement(true);
    try {
      const [nomenc, exec] = await Promise.all([
        listerRubriquesRecettes(),
        obtenirExecutionN1(ex),
      ]);
      setN1(exec.exercice_n1);
      const base = aplatir(nomenc.rubriques ?? []);
      const parCode = new Map(
        (exec.lignes ?? []).map((l) => [l.rubrique_code, moisVersNombres(l.mois)]),
      );
      setLignes(
        base.length
          ? base.map((l) => ({
              ...l,
              mois: parCode.get(l.id) ?? l.mois,
            }))
          : (exec.lignes ?? []).map((l) => ({
              id: l.rubrique_code,
              code: l.rubrique_code,
              libelle: l.rubrique_code,
              mois: moisVersNombres(l.mois),
            })),
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Chargement impossible.");
      setLignes([]);
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
      const res = await enregistrerExecutionN1(annee, {
        lignes: rows.map((r) => ({
          rubrique_code: r.code ?? r.id,
          mois: r.mois.map((m) => String(m || 0)),
        })),
      });
      const parCode = new Map(
        (res.lignes ?? []).map((l) => [l.rubrique_code, moisVersNombres(l.mois)]),
      );
      setLignes((prev) =>
        prev.map((l) => ({
          ...l,
          mois: parCode.get(l.id) ?? Array.from({ length: 12 }, () => 0),
        })),
      );
      toast.success(`Exécution ${res.exercice_n1} enregistrée.`);
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="rounded-[10px] border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2 text-[12.5px] text-[#64748b]">
        Référence 2024 : pétrole 1 129 419,484163 M ; I.S. pétrole 342 553,516173 M.
        Montants stockés en FCFA. « Reprendre depuis GESPOF » reste désactivé tant
        qu&apos;aucun exercice N-1 n&apos;est clos.
        {n1 != null ? ` · Saisie pour l'exercice ${n1}.` : null}
      </p>
      <SofGrilleMensuellePage
        key={annee ?? "x"}
        config={{
          titre: "Exécution N-1",
          description:
            "Exécution N-1 par rubrique de recettes. Mensuel saisi · cumuls calculés. Toutes les rubriques nomenclature.",
          remplace: "« Recettes Ex Ant » · RD Synthèse",
          importLabel: "Importer le classeur",
          actionSecondaire: {
            label: "Reprendre depuis GESPOF",
            disabled: true,
            title:
              "Désactivé tant qu'aucun exercice N-1 n'est clos dans GESPOF.",
          },
          lignes,
          chargement: chargementEx || chargement || annee == null,
          enCours,
          onEnregistrer,
          onImporter: () =>
            toast.message(
              "Import Recettes Ex Ant (millions → FCFA) — parseur à venir ; utiliser Enregistrer avec saisie.",
            ),
        }}
      />
    </div>
  );
}
