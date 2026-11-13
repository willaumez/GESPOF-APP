import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { SofEtatTablePage } from "@/portails/Sof/components/SofEtatTablePage";
import { obtenirExecutionTitres } from "@/portails/Sof/api/execution";
import { usePeriode } from "@/portails/Sof/hooks/PeriodeContext";

export default function Page() {
  const { periodeSof } = usePeriode();
  const [lignes, setLignes] = useState<
    Array<Record<string, string | number | null>>
  >([]);
  const [sousTitre, setSousTitre] = useState<string>();
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    setChargement(true);
    obtenirExecutionTitres(periodeSof?.id ?? null)
      .then((data) => {
        setLignes(
          data.lignes.map((l) => ({
            code: String(l.code ?? ""),
            libelle: String(l.libelle ?? ""),
            dotation: Number(l.dotation) || 0,
            ordonne: Number(l.ordonne) || 0,
            pct_ord: l.pct_ord != null ? `${l.pct_ord} %` : "—",
            regl_ex: Number(l.regl_ex) || 0,
            restes_ex: Number(l.restes_ex) || 0,
            instances_ant: Number(l.instances_ant) || 0,
            regl_ant: Number(l.regl_ant) || 0,
            restes_ant: Number(l.restes_ant) || 0,
            total_reglements: Number(l.total_reglements) || 0,
            _fw: 1,
          })),
        );
        setSousTitre(
          data.blocage_publication
            ? "Publication bloquée : reste(s) négatif(s)"
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
      <div className="flex min-h-[200px] items-center justify-center gap-2 text-[13px] text-[#64748b]">
        <Loader2 size={16} className="animate-spin" /> Chargement…
      </div>
    );
  }

  return (
    <SofEtatTablePage
      config={{
        titre: "Exécution par titres",
        description: "Dotation, ordonnancé, règlements et restes par titre.",
        remplace: "Analyse des Règlements › Titre · SPEC §10.2",
        colonnes: [
          { key: "code", label: "Titre", mono: true, width: "50px" },
          { key: "libelle", label: "Libellé" },
          { key: "dotation", label: "Dotation", align: "r", montant: true },
          { key: "ordonne", label: "Ordonnancé", align: "r", montant: true },
          { key: "pct_ord", label: "% ord.", align: "r", mono: true, width: "70px" },
          { key: "regl_ex", label: "Réglé ex.", align: "r", montant: true },
          { key: "restes_ex", label: "Restes ex.", align: "r", montant: true },
          { key: "instances_ant", label: "Inst. ant.", align: "r", montant: true },
          { key: "regl_ant", label: "Réglé ant.", align: "r", montant: true },
          { key: "restes_ant", label: "Restes ant.", align: "r", montant: true },
          { key: "total_reglements", label: "Total régl.", align: "r", montant: true },
        ],
        lignes,
        sousTitre,
      }}
    />
  );
}
