import { useEffect, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { SofPageHeader } from "@/portails/Sof/components/layout/SofPageHeader";
import {
  CardShell,
  MONO,
  SOF_VERT,
  tdCls,
  thCls,
} from "@/portails/Sof/components/SofCards";
import { obtenirDgbfip, telechargerDgbfip } from "@/portails/Sof/api/rapports";
import { usePeriode } from "@/portails/Sof/hooks/PeriodeContext";
import { formatMontant } from "@/shared/lib/format";

type Onglet = "recettes" | "depenses" | "tresorerie";

const TABS: Array<{ id: Onglet; label: string }> = [
  { id: "recettes", label: "Recettes" },
  { id: "depenses", label: "Dépenses" },
  { id: "tresorerie", label: "Trésorerie" },
];

export default function Page() {
  const { periodeSof } = usePeriode();
  const [loi, setLoi] = useState("LFR");
  const [onglet, setOnglet] = useState<Onglet>("recettes");
  const [sousTitre, setSousTitre] = useState("");
  const [data, setData] = useState<{
    recettes: Array<Record<string, string | number | null | string[]>>;
    depenses: Array<Record<string, string | number | null>>;
    tresorerie: Array<Record<string, string>>;
  } | null>(null);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    setChargement(true);
    obtenirDgbfip(periodeSof?.id ?? null, loi)
      .then((res) => {
        setData(res.onglets);
        setSousTitre(
          `${res.parametres.loi} · mois ${res.parametres.mois}` +
            (res.note ? ` · ${res.note}` : ""),
        );
      })
      .catch((e) => {
        toast.error(e instanceof Error ? e.message : "Chargement impossible.");
        setData(null);
      })
      .finally(() => setChargement(false));
  }, [periodeSof?.id, loi]);

  if (chargement && !data) {
    return (
      <div className="flex min-h-[240px] items-center justify-center gap-2 text-[13px] text-[#64748b]">
        <Loader2 size={16} className="animate-spin" /> Chargement…
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <SofPageHeader
        title="Exécution au format DGBFiP"
        description="Recettes, dépenses, trésorerie — en-têtes issus du paramétrage."
        remplace="Exécution DGBFiP.xlsm · SPEC §11"
        actions={
          <div className="flex flex-wrap gap-2">
            <select
              value={loi}
              onChange={(e) => setLoi(e.target.value)}
              className="h-10 rounded-[10px] border border-[#e2e8f0] bg-white px-3 text-sm"
            >
              <option value="LFR">LFR</option>
              <option value="LFI">LFI</option>
            </select>
            <button
              type="button"
              onClick={() =>
                void telechargerDgbfip(periodeSof?.id, loi)
                  .then(() => toast.success("Classeur DGBFiP téléchargé."))
                  .catch((e) =>
                    toast.error(
                      e instanceof Error ? e.message : "Export impossible.",
                    ),
                  )
              }
              className="inline-flex h-10 items-center gap-1.5 rounded-[10px] px-3.5 text-sm font-semibold text-white"
              style={{
                background: `linear-gradient(180deg, ${SOF_VERT} 0%, #1e6650 100%)`,
              }}
            >
              <Download className="size-4" /> Générer le classeur
            </button>
          </div>
        }
      />

      <div className="flex gap-1 border-b border-[#e2e8f0]">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setOnglet(t.id)}
            className="px-3.5 py-2 text-[13.5px] font-medium"
            style={{
              color: onglet === t.id ? "#1e6650" : "#64748b",
              borderBottom:
                onglet === t.id ? "2px solid #2a7f62" : "2px solid transparent",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <CardShell title="DGBFiP" sub={sousTitre || undefined}>
        <div className="overflow-auto">
          <table className="w-full min-w-[720px] border-collapse">
            <thead>
              <tr className="border-b border-[#e2e8f0] bg-[#f8fafc]">
                {onglet === "recettes" && (
                  <>
                    <th className={thCls}>Article</th>
                    <th className={thCls}>Libellé</th>
                    <th className={thCls} style={{ textAlign: "right" }}>
                      LFI/LFR
                    </th>
                    <th className={thCls} style={{ textAlign: "right" }}>
                      Exécution
                    </th>
                    <th className={thCls} style={{ textAlign: "right" }}>
                      Taux
                    </th>
                  </>
                )}
                {onglet === "depenses" && (
                  <>
                    <th className={thCls}>Titre</th>
                    <th className={thCls} style={{ textAlign: "right" }}>
                      LFI
                    </th>
                    <th className={thCls} style={{ textAlign: "right" }}>
                      Ordonnancements
                    </th>
                    <th className={thCls} style={{ textAlign: "right" }}>
                      Règlements
                    </th>
                    <th className={thCls} style={{ textAlign: "right" }}>
                      Taux
                    </th>
                  </>
                )}
                {onglet === "tresorerie" && (
                  <>
                    <th className={thCls}>Rubrique</th>
                    <th className={thCls} style={{ textAlign: "right" }}>
                      Exécution
                    </th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {onglet === "recettes" &&
                (data?.recettes ?? []).map((r, i) => (
                  <tr key={i} className="border-b border-[#f1f5f9]">
                    <td className={tdCls} style={{ fontFamily: MONO }}>
                      {String(r.article ?? "")}
                    </td>
                    <td className={tdCls}>{String(r.libelle ?? "")}</td>
                    <td
                      className={tdCls}
                      style={{ textAlign: "right", fontFamily: MONO }}
                    >
                      {formatMontant(Number(r.lfi) || 0)}
                    </td>
                    <td
                      className={tdCls}
                      style={{ textAlign: "right", fontFamily: MONO }}
                    >
                      {formatMontant(Number(r.execution) || 0)}
                    </td>
                    <td
                      className={tdCls}
                      style={{ textAlign: "right", fontFamily: MONO }}
                    >
                      {r.taux != null ? `${r.taux} %` : "—"}
                    </td>
                  </tr>
                ))}
              {onglet === "depenses" &&
                (data?.depenses ?? []).map((r, i) => (
                  <tr key={i} className="border-b border-[#f1f5f9]">
                    <td className={tdCls}>{String(r.libelle ?? "")}</td>
                    <td
                      className={tdCls}
                      style={{ textAlign: "right", fontFamily: MONO }}
                    >
                      {formatMontant(Number(r.lfi) || 0)}
                    </td>
                    <td
                      className={tdCls}
                      style={{ textAlign: "right", fontFamily: MONO }}
                    >
                      {formatMontant(Number(r.ordonnancements) || 0)}
                    </td>
                    <td
                      className={tdCls}
                      style={{ textAlign: "right", fontFamily: MONO }}
                    >
                      {formatMontant(Number(r.reglements) || 0)}
                    </td>
                    <td
                      className={tdCls}
                      style={{ textAlign: "right", fontFamily: MONO }}
                    >
                      {r.taux != null ? `${r.taux} %` : "—"}
                    </td>
                  </tr>
                ))}
              {onglet === "tresorerie" &&
                (data?.tresorerie ?? []).map((r, i) => (
                  <tr key={i} className="border-b border-[#f1f5f9]">
                    <td className={tdCls}>{String(r.libelle ?? "")}</td>
                    <td
                      className={tdCls}
                      style={{ textAlign: "right", fontFamily: MONO }}
                    >
                      {formatMontant(Number(r.execution) || 0)}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </CardShell>
    </div>
  );
}
