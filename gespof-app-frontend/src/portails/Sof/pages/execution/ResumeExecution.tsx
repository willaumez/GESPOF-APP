import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { SofEtatTablePage } from "@/portails/Sof/components/SofEtatTablePage";
import { obtenirResumeExecution } from "@/portails/Sof/api/execution";
import { usePeriode } from "@/portails/Sof/hooks/PeriodeContext";

export default function Page() {
  const { periodeSof } = usePeriode();
  const [lignes, setLignes] = useState<
    Array<Record<string, string | number | null>>
  >([]);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    setChargement(true);
    obtenirResumeExecution(periodeSof?.id ?? null)
      .then((data) => {
        setLignes(
          data.lignes.map((l) => ({
            code: String(l.code ?? ""),
            libelle: String(l.libelle ?? ""),
            montant: Number(l.montant) || 0,
            _fw: l._fw === 1 ? 1 : 0,
          })),
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
        titre: "Résumé de l'exécution",
        description: "Synthèse dotation / ordonnancé / règlements / RAP.",
        remplace: "Résumé-Titrisation · SPEC §10.3",
        colonnes: [
          { key: "code", label: "Code", mono: true, width: "80px" },
          { key: "libelle", label: "Indicateur" },
          { key: "montant", label: "Montant", align: "r", montant: true },
        ],
        lignes,
      }}
    />
  );
}
