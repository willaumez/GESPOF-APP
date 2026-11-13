import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { SofPageHeader } from "@/portails/Sof/components/layout/SofPageHeader";
import { CardShell } from "@/portails/Sof/components/SofCards";
import { requeteApi } from "@/shared/lib/api";
import { SERVICE_OPERATIONS_ENDPOINTS } from "@/portails/Sof/api/endpoints";

type OrphelinRf = { type: string; detail: string };

/**
 * Référentiel Tables des recettes fiscales — en attente du fichier source.
 * Contrôle : codes RF orphelins (table/nature sans RF, compte → table inexistante).
 */
export default function TablesFiscales() {
  const [orphelins, setOrphelins] = useState<OrphelinRf[]>([]);
  const [chargement, setChargement] = useState(true);
  const [nbComptes, setNbComptes] = useState(0);
  const [nbTables, setNbTables] = useState(0);

  useEffect(() => {
    let actif = true;
    setChargement(true);
    requeteApi<{
      comptes: unknown[];
      tables: unknown[];
      orphelins?: OrphelinRf[];
    }>(SERVICE_OPERATIONS_ENDPOINTS.TABLES_FISCALES)
      .then((data) => {
        if (!actif) return;
        setNbComptes(data.comptes?.length ?? 0);
        setNbTables(data.tables?.length ?? 0);
        setOrphelins(data.orphelins ?? []);
      })
      .catch((e) =>
        toast.error(e instanceof Error ? e.message : "Chargement impossible."),
      )
      .finally(() => {
        if (actif) setChargement(false);
      });
    return () => {
      actif = false;
    };
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <SofPageHeader
        title="Tables des recettes fiscales"
        description="Tables utilisées pour ventiler les recettes fiscales par code RF."
        remplace="Feuilles « Comptes » et « Tables » du suivi des recettes fiscales"
      />

      <CardShell title="Référentiel" sub={chargement ? "…" : `${nbComptes} comptes · ${nbTables} lignes`}>
        {chargement ? (
          <div className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-[#64748b]">
            <Loader2 size={16} className="animate-spin" /> Chargement…
          </div>
        ) : nbComptes === 0 && nbTables === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-[#64748b]">
            En attente du fichier de suivi des recettes fiscales.
            <p className="mt-2 text-[12.5px]">
              Les exemples de démonstration (1812-101 → T1, natures 711…) ont été retirés :
              ce sont des comptes douanes / pétrole, pas des tables RF.
            </p>
          </div>
        ) : (
          <p className="px-4 py-6 text-center text-sm text-[#334155]">
            {nbComptes} compte(s) et {nbTables} ligne(s) chargés.
          </p>
        )}
      </CardShell>

      <CardShell
        title="Contrôle · codes RF orphelins"
        sub={chargement ? "…" : `${orphelins.length} anomalie(s)`}
      >
        {chargement ? (
          <p className="px-4 py-3 text-[13px] text-[#64748b]">Analyse…</p>
        ) : orphelins.length === 0 ? (
          <p className="px-4 py-3 text-[13px] text-[#047857]">
            Aucun orphelin détecté
            {nbComptes === 0 && nbTables === 0
              ? " (référentiel vide)."
              : "."}
          </p>
        ) : (
          <ul className="space-y-1.5 px-4 py-3 text-[13px] text-[#9f1239]">
            {orphelins.map((o, i) => (
              <li key={`${o.type}-${i}`}>
                <span className="font-mono text-[11px] text-[#64748b]">{o.type}</span>{" "}
                · {o.detail}
              </li>
            ))}
          </ul>
        )}
      </CardShell>
    </div>
  );
}
