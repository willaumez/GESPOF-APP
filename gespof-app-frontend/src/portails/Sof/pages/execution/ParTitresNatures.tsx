import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { SofEtatTablePage } from "@/portails/Sof/components/SofEtatTablePage";
import { obtenirExecutionTitresNatures } from "@/portails/Sof/api/execution";
import { usePeriode } from "@/portails/Sof/hooks/PeriodeContext";

export default function Page() {
  const { periodeSof } = usePeriode();
  const [lignes, setLignes] = useState<
    Array<Record<string, string | number | null>>
  >([]);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    setChargement(true);
    obtenirExecutionTitresNatures(periodeSof?.id ?? null)
      .then((data) => {
        setLignes(
          data.lignes.map((l) => ({
            code: String(l.code ?? ""),
            libelle: String(l.libelle ?? ""),
            dotation: Number(l.dotation) || 0,
            ordonne: Number(l.ordonne) || 0,
            regl_ex: Number(l.regl_ex) || 0,
            regl_ant: Number(l.regl_ant) || 0,
            total_reglements: Number(l.total_reglements) || 0,
            _fw: 1,
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
        titre: "Par titres et grandes natures",
        description: "Exécution titre × G_NAT (floor NAT/10000).",
        remplace: "Titre_Nature · SPEC §10.2",
        colonnes: [
          { key: "code", label: "Clé", mono: true, width: "90px" },
          { key: "libelle", label: "Libellé" },
          { key: "dotation", label: "Dotation", align: "r", montant: true },
          { key: "ordonne", label: "Ordonnancé", align: "r", montant: true },
          { key: "regl_ex", label: "Réglé ex.", align: "r", montant: true },
          { key: "regl_ant", label: "Réglé ant.", align: "r", montant: true },
          { key: "total_reglements", label: "Total", align: "r", montant: true },
        ],
        lignes,
      }}
    />
  );
}
