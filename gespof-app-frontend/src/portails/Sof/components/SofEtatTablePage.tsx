import { useMemo, useState, type ReactNode } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { SofPageHeader } from "@/portails/Sof/components/layout/SofPageHeader";
import {
  CardShell,
  MONO,
  tdCls,
  thCls,
} from "@/portails/Sof/components/SofCards";
import { formatMontant } from "@/shared/lib/format";

export type ColonneEtat =
  | { key: string; label: string; width?: string; align?: "l" | "r" | "c"; mono?: boolean; montant?: boolean }
  ;

export type ConfigEtatTable = {
  titre: string;
  description: string;
  remplace?: string;
  colonnes: ColonneEtat[];
  lignes: Array<Record<string, string | number | null>>;
  sousTitre?: string;
  tabs?: Array<{ id: string; label: string }>;
  /** Filtre lignes par tab si une colonne `tab` est présente. */
  tabKey?: string;
  totalKeys?: string[];
  actionsExtra?: ReactNode;
};

/**
 * État / tableau consolidé SOF (SROT, exécution, rapports) — lecture maquette.
 */
export function SofEtatTablePage({ config }: { config: ConfigEtatTable }) {
  const [tab, setTab] = useState(config.tabs?.[0]?.id ?? "");

  const lignes = useMemo(() => {
    if (!config.tabs || !config.tabKey) return config.lignes;
    return config.lignes.filter((l) => String(l[config.tabKey!]) === tab);
  }, [config, tab]);

  const totaux = useMemo(() => {
    const keys = config.totalKeys ?? [];
    const out: Record<string, number> = {};
    for (const k of keys) {
      out[k] = lignes.reduce((s, l) => s + (Number(l[k]) || 0), 0);
    }
    return out;
  }, [lignes, config.totalKeys]);

  return (
    <div className="flex flex-col gap-6">
      <SofPageHeader
        title={config.titre}
        description={config.description}
        remplace={config.remplace}
        actions={
          <div className="flex flex-wrap gap-2">
            {config.actionsExtra}
            <button
              type="button"
              onClick={() => toast.message("Export Excel.")}
              className="inline-flex h-10 items-center gap-1.5 rounded-[10px] border border-[#e2e8f0] bg-white px-3.5 text-sm font-medium text-[#334155]"
            >
              <Download className="size-4" />
              Exporter .xlsx
            </button>
          </div>
        }
      />

      {config.tabs?.length ? (
        <div className="flex gap-1 border-b border-[#e2e8f0]">
          {config.tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className="px-3.5 py-2 text-[13.5px] font-medium"
              style={{
                color: tab === t.id ? "#1e6650" : "#64748b",
                borderBottom: tab === t.id ? "2px solid #2a7f62" : "2px solid transparent",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      ) : null}

      <CardShell
        title={config.titre}
        sub={config.sousTitre ?? `${lignes.length} lignes`}
      >
        <div className="overflow-auto">
          <table className="w-full min-w-[720px] border-collapse">
            <thead>
              <tr className="border-b border-[#e2e8f0] bg-[#f8fafc]">
                {config.colonnes.map((c) => (
                  <th
                    key={c.key}
                    className={thCls}
                    style={{
                      textAlign:
                        c.align === "r" ? "right" : c.align === "c" ? "center" : "left",
                      width: c.width,
                    }}
                  >
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lignes.length === 0 ? (
                <tr>
                  <td
                    colSpan={config.colonnes.length}
                    className="px-4 py-10 text-center text-sm text-[#64748b]"
                  >
                    Aucune donnée pour la période — imports et calculs à brancher.
                  </td>
                </tr>
              ) : (
                lignes.map((l, i) => (
                  <tr key={i} className="border-b border-[#f1f5f9]">
                    {config.colonnes.map((c) => {
                      const v = l[c.key];
                      const txt =
                        c.montant && typeof v === "number"
                          ? formatMontant(v)
                          : v == null || v === ""
                            ? "—"
                            : String(v);
                      return (
                        <td
                          key={c.key}
                          className={tdCls}
                          style={{
                            textAlign:
                              c.align === "r"
                                ? "right"
                                : c.align === "c"
                                  ? "center"
                                  : "left",
                            fontFamily: c.mono || c.montant ? MONO : undefined,
                            fontWeight: l._fw === 1 ? 600 : undefined,
                          }}
                        >
                          {txt}
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
              {config.totalKeys?.length && lignes.length > 0 ? (
                <tr className="bg-[#f0f7f4]">
                  {config.colonnes.map((c, idx) => (
                    <td
                      key={c.key}
                      className={tdCls}
                      style={{
                        fontWeight: 600,
                        textAlign: c.align === "r" ? "right" : "left",
                        fontFamily: c.montant ? MONO : undefined,
                      }}
                    >
                      {idx === 0
                        ? "Total"
                        : c.montant && totaux[c.key] != null
                          ? formatMontant(totaux[c.key])
                          : ""}
                    </td>
                  ))}
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </CardShell>
    </div>
  );
}
