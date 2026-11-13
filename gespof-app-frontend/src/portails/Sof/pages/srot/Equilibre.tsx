import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { SofEtatTablePage } from "@/portails/Sof/components/SofEtatTablePage";
import { obtenirEquilibreSrot } from "@/portails/Sof/api/srot";
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
    obtenirEquilibreSrot(periodeSof?.id ?? null)
      .then((data) => {
        setLignes(
          data.lignes.map((l) => ({
            code: l.id,
            libelle: l.libelle,
            lfi: l.lfi != null ? Number(l.lfi) || 0 : null,
            lfr: l.lfr != null ? Number(l.lfr) || 0 : null,
            prevision: l.prevision != null ? Number(l.prevision) || 0 : null,
            execution: l.execution != null ? Number(l.execution) || 0 : null,
            taux: l.taux != null ? `${l.taux} %` : null,
            prevision_cumulee:
              l.prevision_cumulee != null
                ? Number(l.prevision_cumulee) || 0
                : null,
            execution_cumulee:
              l.execution_cumulee != null
                ? Number(l.execution_cumulee) || 0
                : null,
            taux_cumule: l.taux_cumule != null ? `${l.taux_cumule} %` : null,
            _fw: l.niveau === 0 || l.section ? 1 : 0,
          })),
        );
        const p = data.periode;
        setSousTitre(
          p
            ? `Exercice ${p.exercice_annee} · mois ${p.mois} · EQUILIBRE-Titrisation`
            : data.note,
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
        titre: "Équilibre",
        description:
          "Prévision, exécution et taux — EQUILIBRE-Titrisation (SPEC §8.4).",
        remplace: "Feuille ÉQUILIBRE-Titrisation · srot-equilibre",
        colonnes: [
          { key: "code", label: "Code", mono: true, width: "72px" },
          { key: "libelle", label: "Rubrique", width: "220px" },
          { key: "lfi", label: "LFI", align: "r", montant: true },
          { key: "lfr", label: "LFR", align: "r", montant: true },
          { key: "prevision", label: "Prévision", align: "r", montant: true },
          { key: "execution", label: "Exécution", align: "r", montant: true },
          { key: "taux", label: "Taux", align: "r", mono: true },
          {
            key: "prevision_cumulee",
            label: "Prév. cumulée",
            align: "r",
            montant: true,
          },
          {
            key: "execution_cumulee",
            label: "Exéc. cumulée",
            align: "r",
            montant: true,
          },
          { key: "taux_cumule", label: "Taux cumulé", align: "r", mono: true },
        ],
        lignes,
        sousTitre,
      }}
    />
  );
}
