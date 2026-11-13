import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { SofEtatTablePage } from "@/portails/Sof/components/SofEtatTablePage";
import { obtenirSituationSrot } from "@/portails/Sof/api/srot";
import { usePeriode } from "@/portails/Sof/hooks/PeriodeContext";

export default function Page() {
  const { periodeSof } = usePeriode();
  const [lignes, setLignes] = useState<
    Array<Record<string, string | number | null>>
  >([]);
  const [sousTitre, setSousTitre] = useState<string | undefined>();
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    setChargement(true);
    obtenirSituationSrot(periodeSof?.id ?? null)
      .then((data) => {
        setLignes(
          data.lignes.map((l) => ({
            code: l.id,
            libelle: l.libelle,
            cumul_precedent: Number(l.cumul_precedent) || 0,
            mois: Number(l.mois) || 0,
            cumul: Number(l.cumul) || 0,
            _fw: l.niveau === 0 || l.section ? 1 : 0,
          })),
        );
        const p = data.periode;
        setSousTitre(
          p
            ? `Exercice ${p.exercice_annee} · mois ${p.mois} · FCFA · ${data.lignes.length} lignes`
            : undefined,
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
      <div className="flex min-h-[240px] items-center justify-center gap-2 text-[13px] text-[#64748b]">
        <Loader2 size={16} className="animate-spin" /> Chargement…
      </div>
    );
  }

  return (
    <SofEtatTablePage
      config={{
        titre: "Situation résumée",
        description:
          "De la balance d'entrée à l'équilibre de trésorerie (SPEC §8.2).",
        remplace: "RD Synthèse Analyse · SROT · srot-situation",
        colonnes: [
          { key: "code", label: "Code", mono: true, width: "80px" },
          { key: "libelle", label: "Rubrique" },
          {
            key: "cumul_precedent",
            label: "Cumul fin mois préc.",
            align: "r",
            montant: true,
          },
          { key: "mois", label: "Mois", align: "r", montant: true },
          { key: "cumul", label: "Cumul à date", align: "r", montant: true },
        ],
        lignes,
        sousTitre,
      }}
    />
  );
}
