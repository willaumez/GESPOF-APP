import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { SofEtatTablePage } from "@/portails/Sof/components/SofEtatTablePage";
import { listerPublications } from "@/portails/Sof/api/validation";
import { usePeriode } from "@/portails/Sof/hooks/PeriodeContext";

export default function Page() {
  const { periodeSof } = usePeriode();
  const [lignes, setLignes] = useState<
    Array<Record<string, string | number | null>>
  >([]);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    setChargement(true);
    listerPublications({
      exercice: periodeSof?.exercice_annee,
    })
      .then((data) => {
        setLignes(
          data.publications.map((p) => ({
            libelle: p.libelle,
            version: `v${p.version}`,
            type: p.type_document,
            publie_le: p.publie_le,
            auteur: p.publie_par ?? "—",
            sections: (p.composition_sections ?? []).join(", "),
          })),
        );
      })
      .catch((e) => {
        toast.error(e instanceof Error ? e.message : "Chargement impossible.");
        setLignes([]);
      })
      .finally(() => setChargement(false));
  }, [periodeSof?.exercice_annee]);

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
        titre: "Publications",
        description: "Historique des publications SROT et rapports transmis.",
        remplace: "srot_publication · SPEC §11",
        colonnes: [
          { key: "libelle", label: "Document" },
          { key: "version", label: "Version", mono: true, width: "80px" },
          { key: "type", label: "Type", mono: true, width: "100px" },
          { key: "publie_le", label: "Publié le", mono: true, width: "160px" },
          { key: "auteur", label: "Auteur" },
          { key: "sections", label: "Composition" },
        ],
        lignes,
        sousTitre: `${lignes.length} publication(s)`,
      }}
    />
  );
}
