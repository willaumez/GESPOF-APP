import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { SofEtatTablePage } from "@/portails/Sof/components/SofEtatTablePage";
import { obtenirSoldesSrot } from "@/portails/Sof/api/srot";
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
    obtenirSoldesSrot(periodeSof?.id ?? null)
      .then((data) => {
        setLignes(
          data.lignes.map((l) => ({
            code: l.id,
            libelle: l.libelle,
            mois: Number(l.mois) || 0,
            cumul: Number(l.cumul) || 0,
            _fw: 1,
          })),
        );
        const p = data.periode;
        setSousTitre(
          p
            ? `Exercice ${p.exercice_annee} · mois ${p.mois} · SPEC §8.3`
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
        titre: "Soldes de gestion",
        description: "Soldes caractéristiques de gestion. Lecture seule.",
        remplace: "RD Synthèse Analyse · Soldes · srot-soldes",
        colonnes: [
          { key: "code", label: "Code", mono: true, width: "80px" },
          { key: "libelle", label: "Solde" },
          { key: "mois", label: "Mois", align: "r", montant: true },
          { key: "cumul", label: "Cumul", align: "r", montant: true },
        ],
        lignes,
        sousTitre,
      }}
    />
  );
}
