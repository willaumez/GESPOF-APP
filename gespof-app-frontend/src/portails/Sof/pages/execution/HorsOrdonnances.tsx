import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { SofEtatTablePage } from "@/portails/Sof/components/SofEtatTablePage";
import { obtenirHorsOrdonnances } from "@/portails/Sof/api/execution";
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
    obtenirHorsOrdonnances(periodeSof?.id ?? null)
      .then((data) => {
        setLignes(
          data.lignes.map((l) => ({
            ordonnance: String(l.ordonnance ?? ""),
            date: String(l.date ?? "—"),
            beneficiaire: String(l.beneficiaire ?? "—"),
            titre: String(l.titre ?? "—"),
            montant: Number(l.montant) || 0,
          })),
        );
        setSousTitre(
          `${data.kpis.nb_lignes} lignes · ${data.kpis.part_pct} % des règlements`,
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
        titre: "Règlements hors RAP et ordonnances",
        description:
          "Règlements dont l'ordonnance n'est ni dans les RAP antérieurs ni rattachée.",
        remplace: "autre_regl · SPEC §10.2",
        colonnes: [
          { key: "ordonnance", label: "Ordonnance", mono: true },
          { key: "date", label: "Date", mono: true, width: "100px" },
          { key: "beneficiaire", label: "Bénéficiaire" },
          { key: "titre", label: "Titre", mono: true, width: "60px" },
          { key: "montant", label: "Montant", align: "r", montant: true },
        ],
        lignes,
        totalKeys: ["montant"],
        sousTitre,
      }}
    />
  );
}
