import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { SofPageHeader } from "@/portails/Sof/components/layout/SofPageHeader";
import {
  CardShell,
  MONO,
  SofBarreFiltres,
  SofPeriodeSelect,
  tdCls,
  thCls,
  usePeriodesSof,
} from "@/portails/Sof/components/SofCards";
import {
  obtenirFiscalesAppariement,
  type FiscalesAppariementPage,
  type LigneAppariementFiscal,
} from "@/portails/Sof/api/recettes-fiscales";
import { formatMontant } from "@/shared/lib/format";

type Tab = "ok" | "amb" | "non";

function dateFr(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

/**
 * Transferts ↔ prises en charge — SPEC §5.3 (Methods.RecettesImpots).
 */
export default function FiscalesAppariement() {
  const { periodes, periodeId, setPeriodeId } = usePeriodesSof();
  const [tab, setTab] = useState<Tab>("ok");
  const [data, setData] = useState<FiscalesAppariementPage | null>(null);
  const [chargement, setChargement] = useState(false);

  useEffect(() => {
    if (periodeId === "") return;
    setChargement(true);
    obtenirFiscalesAppariement(Number(periodeId))
      .then(setData)
      .catch((e) =>
        toast.error(e instanceof Error ? e.message : "Chargement impossible."),
      )
      .finally(() => setChargement(false));
  }, [periodeId]);

  const lignes: LigneAppariementFiscal[] =
    tab === "ok"
      ? (data?.apparies ?? [])
      : tab === "amb"
        ? (data?.ambigus ?? [])
        : (data?.non_apparies ?? []);

  const stats = data?.stats;

  return (
    <div className="flex flex-col gap-6">
      <SofPageHeader
        title="Transferts ↔ prises en charge"
        description="Appariement 1812 ↔ 4781/4783 sur matricule + montant (un à un). Cas ambigus à trancher par l'agent."
        remplace="Methods.RecettesImpots · SPEC §5.3"
      />

      <SofBarreFiltres>
        <SofPeriodeSelect
          periodes={periodes}
          value={periodeId}
          onChange={setPeriodeId}
        />
      </SofBarreFiltres>

      {data?.message ? (
        <p className="text-[13.5px] text-[#64748b]">{data.message}</p>
      ) : null}

      <div className="flex gap-1 border-b border-[#e2e8f0]">
        {(
          [
            ["ok", `Appariés · ${stats?.nb_apparies ?? 0}`],
            ["amb", `Ambigus · ${stats?.nb_ambigus ?? 0}`],
            ["non", `Non appariés · ${stats?.nb_non_apparies ?? 0}`],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className="px-3.5 py-2 text-[13.5px] font-medium"
            style={{
              color: tab === id ? "#1e6650" : "#64748b",
              borderBottom:
                tab === id ? "2px solid #2a7f62" : "2px solid transparent",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {chargement ? (
        <div className="flex min-h-[160px] items-center justify-center gap-2 text-[13px] text-[#64748b]">
          <Loader2 size={16} className="animate-spin" /> Chargement…
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <CardShell title="Transferts 1812" sub={`${lignes.length} lignes`}>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-[#e2e8f0] bg-[#f8fafc]">
                    <th className={thCls} style={{ textAlign: "left" }}>
                      Date
                    </th>
                    <th className={thCls} style={{ textAlign: "left" }}>
                      Matricule
                    </th>
                    <th className={thCls} style={{ textAlign: "left" }}>
                      Société
                    </th>
                    <th className={thCls} style={{ textAlign: "right" }}>
                      Montant
                    </th>
                    <th className={thCls} style={{ textAlign: "left" }}>
                      RF
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {lignes.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className={`${tdCls} text-center text-[#64748b]`}
                      >
                        Aucune ligne.
                      </td>
                    </tr>
                  ) : (
                    lignes.map((x) => (
                      <tr
                        key={`tr-${x.id ?? x.n_mattir}-${x.m_regl}`}
                        className="border-b border-[#f1f5f9]"
                      >
                        <td className={tdCls} style={{ fontFamily: MONO }}>
                          {dateFr(x.d_cpta)}
                        </td>
                        <td className={tdCls} style={{ fontFamily: MONO }}>
                          {x.n_mattir ?? "—"}
                        </td>
                        <td className={tdCls}>
                          {x.l_tiers ?? "—"}
                          {x.petrole ? (
                            <span className="ml-1 text-[11px] text-[#b45309]">
                              · pétrole
                            </span>
                          ) : null}
                        </td>
                        <td
                          className={tdCls}
                          style={{ textAlign: "right", fontFamily: MONO }}
                        >
                          {formatMontant(Number(x.m_regl ?? 0))}
                        </td>
                        <td className={tdCls} style={{ fontFamily: MONO }}>
                          {x.code_rf ?? "—"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardShell>

          <CardShell
            title="Prises en charge 4781 / 4783"
            sub={`${lignes.length} lignes`}
          >
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-[#e2e8f0] bg-[#f8fafc]">
                    <th className={thCls} style={{ textAlign: "left" }}>
                      Compte
                    </th>
                    <th className={thCls} style={{ textAlign: "left" }}>
                      Nature
                    </th>
                    <th className={thCls} style={{ textAlign: "left" }}>
                      Matricule
                    </th>
                    <th className={thCls} style={{ textAlign: "right" }}>
                      Montant
                    </th>
                    <th className={thCls} style={{ textAlign: "left" }}>
                      {tab === "amb" ? "Candidats" : "Clé"}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {lignes.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className={`${tdCls} text-center text-[#64748b]`}
                      >
                        Aucune ligne.
                      </td>
                    </tr>
                  ) : (
                    lignes.map((x) => {
                      const pec = x.pec;
                      return (
                        <tr
                          key={`pec-${x.id ?? x.n_mattir}-${x.m_regl}`}
                          className="border-b border-[#f1f5f9]"
                        >
                          <td className={tdCls} style={{ fontFamily: MONO }}>
                            {pec?.c_it ??
                              (tab === "non" ? "—" : x.c_it ?? "—")}
                          </td>
                          <td className={tdCls} style={{ fontFamily: MONO }}>
                            {pec?.c_nat ?? "—"}
                          </td>
                          <td className={tdCls} style={{ fontFamily: MONO }}>
                            {tab === "non" ? "—" : (pec?.n_mattir ?? x.n_mattir ?? "—")}
                          </td>
                          <td
                            className={tdCls}
                            style={{ textAlign: "right", fontFamily: MONO }}
                          >
                            {tab === "non"
                              ? "—"
                              : formatMontant(
                                  Number(pec?.m_regl ?? x.m_regl ?? 0),
                                )}
                          </td>
                          <td
                            className={tdCls}
                            style={{ fontFamily: MONO, color: "#475569" }}
                          >
                            {tab === "non"
                              ? "Aucune PEC"
                              : tab === "amb"
                                ? `${x.candidats?.length ?? 0} candidats`
                                : `${x.n_mattir ?? ""} + ${formatMontant(Number(x.m_regl ?? 0))}`}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </CardShell>
        </div>
      )}

      {stats ? (
        <p className="text-[12.5px] text-[#64748b]">
          Lot · {stats.nb_ops_lot} ops · {stats.nb_retenues} retenues ·{" "}
          {stats.nb_transferts} transferts · {stats.nb_pec} PEC
          {stats.nb_pec_orphelines
            ? ` · ${stats.nb_pec_orphelines} PEC non utilisées`
            : ""}
        </p>
      ) : null}
    </div>
  );
}
