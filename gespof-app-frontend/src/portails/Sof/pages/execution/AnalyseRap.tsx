import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { SofEtatTablePage } from "@/portails/Sof/components/SofEtatTablePage";
import { obtenirRapSynthese } from "@/portails/Sof/api/execution";
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
    obtenirRapSynthese(periodeSof?.id ?? null)
      .then((data) => {
        setLignes(
          data.synthese.lignes.map((l) => ({
            c_categ: l.c_categ,
            type: l.type,
            exercice: l.exercice,
            rap: Number(l.rap) || 0,
            _fw: l.c_categ === "CDEL" ? 1 : 0,
          })),
        );
        const t = data.synthese.totaux;
        setSousTitre(
          `Ant. ${Number(t.antérieurs).toLocaleString("fr-FR")} · Ex. ${Number(t.exercice).toLocaleString("fr-FR")} · Total ${Number(t.total).toLocaleString("fr-FR")}`,
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
        titre: "Analyse des RAP",
        description: "RAP Synthèse : C_CATEG × TYPE × EXERCICE + CDEL.",
        remplace: "RAP Synthèse · SPEC §10.2.7",
        colonnes: [
          { key: "c_categ", label: "Catégorie", mono: true, width: "90px" },
          { key: "type", label: "Type", mono: true, width: "60px" },
          { key: "exercice", label: "Exercice", mono: true, width: "70px" },
          { key: "rap", label: "RAP", align: "r", montant: true },
        ],
        lignes,
        totalKeys: ["rap"],
        sousTitre,
      }}
    />
  );
}
