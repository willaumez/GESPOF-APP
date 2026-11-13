import { useEffect, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { SofEtatTablePage } from "@/portails/Sof/components/SofEtatTablePage";
import {
  obtenirEtatDepensesRdModel,
  recalculerCumulRdModel,
  type EtatRdModel,
} from "@/portails/Sof/api/rd-model";
import { usePeriode } from "@/portails/Sof/hooks/PeriodeContext";
import { useAuth } from "@/shared/hooks/use-auth";

export default function Page() {
  const { periodeSof } = usePeriode();
  const { hasAnyRole } = useAuth();
  const estChef = hasAnyRole(["CHEF_SOF"]);
  const [etat, setEtat] = useState<EtatRdModel | null>(null);
  const [chargement, setChargement] = useState(true);
  const [recalc, setRecalc] = useState(false);

  async function charger() {
    setChargement(true);
    try {
      const { etat: e } = await obtenirEtatDepensesRdModel(periodeSof?.id ?? null);
      setEtat(e);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Chargement impossible.");
      setEtat(null);
    } finally {
      setChargement(false);
    }
  }

  useEffect(() => {
    void charger();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- période SOF
  }, [periodeSof?.id]);

  async function onRecalculer() {
    if (!estChef) return;
    setRecalc(true);
    try {
      const { cumul } = await recalculerCumulRdModel({
        periode_id: periodeSof?.id ?? null,
        exercice: etat?.exercice,
      });
      toast.success(
        `Cumul AUTO reconstruit · ${cumul.nb_codes} codes · ${cumul.nb_cellules} cellules.`,
      );
      await charger();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Recalcul impossible.");
    } finally {
      setRecalc(false);
    }
  }

  if (chargement && !etat) {
    return (
      <div className="flex min-h-[240px] items-center justify-center gap-2 text-[13px] text-[#64748b]">
        <Loader2 size={16} className="animate-spin" /> Chargement…
      </div>
    );
  }

  const lignes =
    etat?.lignes.map((l) => ({
      code: l.code,
      libelle: l.libelle,
      mois: Number(l.mois) || 0,
      cumul: Number(l.cumul) || 0,
      _fw: l.niveau <= 1 ? 1 : 0,
    })) ?? [];

  return (
    <SofEtatTablePage
      config={{
        titre: "Dépenses consolidées",
        description:
          "SROT consolidé (§8.1) : AUTO + MANUEL + ajustements.",
        remplace: "RD Synthèse Analyse · Dépenses · srot-depenses",
        colonnes: [
          { key: "code", label: "Code", mono: true, width: "80px" },
          { key: "libelle", label: "Rubrique" },
          { key: "mois", label: "Mois", align: "r", montant: true },
          { key: "cumul", label: "Cumul", align: "r", montant: true },
        ],
        lignes,
        totalKeys: ["mois", "cumul"],
        sousTitre: etat
          ? `Exercice ${etat.exercice} · mois ${etat.mois} · ${etat.origine} · FCFA · ${etat.lignes.length} lignes`
          : undefined,
        actionsExtra: estChef ? (
          <button
            type="button"
            disabled={recalc}
            onClick={() => void onRecalculer()}
            className="inline-flex h-10 items-center gap-1.5 rounded-[10px] border border-[#e2e8f0] bg-white px-3.5 text-sm font-medium text-[#334155] disabled:opacity-50"
          >
            {recalc ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
            Recalculer AUTO
          </button>
        ) : undefined,
      }}
    />
  );
}
