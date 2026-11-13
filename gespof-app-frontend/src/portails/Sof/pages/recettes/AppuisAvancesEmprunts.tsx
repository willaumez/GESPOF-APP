import { useEffect, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
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
  obtenirAppuisEmprunts,
  recalculerAppuisEmprunts,
  type AppuisEmpruntsPage,
} from "@/portails/Sof/api/appuis-emprunts";
import { formatMontant } from "@/shared/lib/format";
import { useAuth } from "@/shared/hooks/use-auth";

const MOIS_ABR = [
  "J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D",
] as const;

export default function AppuisAvancesEmprunts() {
  const { periodes, periodeId, setPeriodeId } = usePeriodesSof();
  const { hasAnyRole } = useAuth();
  const estChef = hasAnyRole(["CHEF_SOF"]);
  const [data, setData] = useState<AppuisEmpruntsPage | null>(null);
  const [chargement, setChargement] = useState(false);
  const [recalc, setRecalc] = useState(false);

  useEffect(() => {
    if (periodeId === "") return;
    setChargement(true);
    obtenirAppuisEmprunts(Number(periodeId))
      .then(setData)
      .catch((e) =>
        toast.error(e instanceof Error ? e.message : "Chargement impossible."),
      )
      .finally(() => setChargement(false));
  }, [periodeId]);

  async function onRecalculer() {
    if (!estChef || periodeId === "") return;
    setRecalc(true);
    try {
      const res = await recalculerAppuisEmprunts(Number(periodeId));
      setData(res.etat);
      toast.success(`Report SROT · ${res.nb_lignes} cellules.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Recalcul impossible.");
    } finally {
      setRecalc(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <SofPageHeader
        title="Appuis, avances et emprunts"
        description="Report CodeM (dépenses manuelles) → codes SROT recettes (AV, AUU, AW, AY…). "
        remplace="RD Model › Avance Appuis et Emprunts · SPEC §5.6"
        actions={
          estChef ? (
            <button
              type="button"
              disabled={recalc || periodeId === ""}
              onClick={() => void onRecalculer()}
              className="inline-flex h-[38px] items-center gap-2 rounded-md border border-[#cbd5e1] bg-white px-3.5 text-[13.5px] font-semibold disabled:opacity-50"
            >
              {recalc ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <RefreshCw size={16} />
              )}
              Reporter vers SROT
            </button>
          ) : undefined
        }
      />

      <SofBarreFiltres>
        <SofPeriodeSelect
          periodes={periodes}
          value={periodeId}
          onChange={setPeriodeId}
        />
      </SofBarreFiltres>

      {data?.message ? (
        <p className="text-[13px] text-[#64748b]">{data.message}</p>
      ) : null}

      <CardShell
        title="Correspondance CodeM → SROT"
        sub={data ? `Exercice ${data.exercice} · mois ${data.mois}` : undefined}
      >
        {chargement ? (
          <div className="flex min-h-[160px] items-center justify-center gap-2 text-[13px] text-[#64748b]">
            <Loader2 size={16} className="animate-spin" /> Chargement…
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] border-collapse">
              <thead>
                <tr className="border-b border-[#e2e8f0] bg-[#f8fafc]">
                  <th className={thCls} style={{ textAlign: "left" }}>
                    Libellé
                  </th>
                  <th className={thCls} style={{ textAlign: "left" }}>
                    CodeM
                  </th>
                  <th className={thCls} style={{ textAlign: "left" }}>
                    SROT
                  </th>
                  {MOIS_ABR.map((m) => (
                    <th key={m} className={thCls} style={{ textAlign: "right" }}>
                      {m}
                    </th>
                  ))}
                  <th className={thCls} style={{ textAlign: "right" }}>
                    Cumul
                  </th>
                </tr>
              </thead>
              <tbody>
                {(data?.lignes ?? []).map((l) => (
                  <tr key={l.code_m} className="border-b border-[#f1f5f9]">
                    <td className={tdCls}>{l.libelle}</td>
                    <td className={tdCls} style={{ fontFamily: MONO }}>
                      {l.code_m}
                    </td>
                    <td className={tdCls} style={{ fontFamily: MONO }}>
                      {l.code_srot ?? "—"}
                    </td>
                    {l.mois.map((v, i) => (
                      <td
                        key={`${l.code_m}-${i}`}
                        className={tdCls}
                        style={{ textAlign: "right", fontFamily: MONO }}
                      >
                        {formatMontant(Number(v))}
                      </td>
                    ))}
                    <td
                      className={tdCls}
                      style={{
                        textAlign: "right",
                        fontFamily: MONO,
                        fontWeight: 600,
                      }}
                    >
                      {formatMontant(Number(l.cumul))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardShell>
    </div>
  );
}
