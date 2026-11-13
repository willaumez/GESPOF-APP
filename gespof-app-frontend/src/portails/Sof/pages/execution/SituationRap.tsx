import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { SofEtatTablePage } from "@/portails/Sof/components/SofEtatTablePage";
import { obtenirSituationRap } from "@/portails/Sof/api/execution";
import { usePeriode } from "@/portails/Sof/hooks/PeriodeContext";

export default function Page() {
  const { periodeSof } = usePeriode();
  const [vue, setVue] = useState("");
  const [vues, setVues] = useState<string[]>([]);
  const [lignes, setLignes] = useState<
    Array<Record<string, string | number | null>>
  >([]);
  const [sousTitre, setSousTitre] = useState<string>();
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    setChargement(true);
    obtenirSituationRap(periodeSof?.id ?? null, vue || undefined)
      .then((data) => {
        setVues(data.vues ?? []);
        setLignes(
          data.lignes.map((l) => ({
            statut: String(l.statut ?? ""),
            echeance: String(l.echeance ?? "—"),
            exercice: String(l.exercice_label ?? ""),
            type: String(l.type ?? ""),
            c_categ: String(l.c_categ ?? ""),
            ordonnance: String(l.ordonnance ?? ""),
            ministere: String(l.ministere ?? "—"),
            brut: Number(l.brut) || 0,
            rap: Number(l.rap) || 0,
            source: String(l.source ?? ""),
          })),
        );
        setSousTitre(
          `${data.kpis.nb_lignes} lignes · RAP ${Number(data.kpis.total_rap).toLocaleString("fr-FR")} FCFA`,
        );
      })
      .catch((e) => {
        toast.error(e instanceof Error ? e.message : "Chargement impossible.");
        setLignes([]);
      })
      .finally(() => setChargement(false));
  }, [periodeSof?.id, vue]);

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
        titre: "Situation des RAP",
        description:
          "Restes à payer (RAP antérieurs + CDEL). XRAV à brancher dès disponible.",
        remplace: "Methods.donnees_rap · SPEC §10.1",
        colonnes: [
          { key: "statut", label: "Statut", width: "90px" },
          { key: "echeance", label: "Échéance", mono: true, width: "100px" },
          { key: "exercice", label: "Ex.", mono: true, width: "50px" },
          { key: "type", label: "Type", mono: true, width: "50px" },
          { key: "c_categ", label: "Catég.", mono: true, width: "60px" },
          { key: "ordonnance", label: "Ordonnance", mono: true },
          { key: "ministere", label: "Ministère" },
          { key: "brut", label: "Brut", align: "r", montant: true },
          { key: "rap", label: "RAP", align: "r", montant: true },
          { key: "source", label: "Source", mono: true, width: "110px" },
        ],
        lignes,
        sousTitre,
        actionsExtra: (
          <select
            value={vue}
            onChange={(e) => setVue(e.target.value)}
            className="h-10 rounded-[10px] border border-[#e2e8f0] bg-white px-3 text-sm"
          >
            <option value="">Toutes les vues</option>
            {vues.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        ),
      }}
    />
  );
}
