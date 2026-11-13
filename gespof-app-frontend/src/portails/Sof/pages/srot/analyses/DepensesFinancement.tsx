import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { SofEtatTablePage } from "@/portails/Sof/components/SofEtatTablePage";
import { obtenirSituationSrot } from "@/portails/Sof/api/srot";
import { usePeriode } from "@/portails/Sof/hooks/PeriodeContext";

const IDS = ["C", "C_ANT", "C_COUR", "D", "F"] as const;

export default function Page() {
  const { periodeSof } = usePeriode();
  const [lignes, setLignes] = useState<
    Array<Record<string, string | number | null>>
  >([]);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    setChargement(true);
    obtenirSituationSrot(periodeSof?.id ?? null)
      .then((data) => {
        const map = new Map(data.lignes.map((l) => [l.id, l]));
        setLignes(
          IDS.map((id) => {
            const l = map.get(id);
            return {
              code: id,
              libelle: l?.libelle ?? id,
              mois: Number(l?.mois) || 0,
              cumul: Number(l?.cumul) || 0,
              _fw: id === "C" || id === "D" || id === "F" ? 1 : 0,
            };
          }),
        );
      })
      .catch((e) => {
        toast.error(e instanceof Error ? e.message : "Chargement impossible.");
        setLignes([]);
      })
      .finally(() => setChargement(false));
  }, [periodeSof?.id]);

  if (chargement) {
    return (
      <div className="flex min-h-[200px] items-center justify-center gap-2 text-[13px] text-[#64748b]">
        <Loader2 size={16} className="animate-spin" /> Chargement…
      </div>
    );
  }

  return (
    <SofEtatTablePage
      config={{
        titre: "Dépenses et financement",
        description: "Dépenses budgétaires, nettes de trésorerie et financement.",
        remplace: "RD Synthèse Analyse · ana-dep-financement",
        colonnes: [
          { key: "code", label: "Code", mono: true, width: "80px" },
          { key: "libelle", label: "Titres et catégories" },
          { key: "mois", label: "Mois", align: "r", montant: true },
          { key: "cumul", label: "Cumul", align: "r", montant: true },
        ],
        lignes,
      }}
    />
  );
}
