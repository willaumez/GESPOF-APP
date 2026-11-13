import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { SofPageHeader } from "@/portails/Sof/components/layout/SofPageHeader";
import { SofUniteSeg } from "@/portails/Sof/components/SofUniteSeg";
import {
  obtenirConsolidation,
  recalculerConsolidation,
  type ConsolidationPage,
} from "@/portails/Sof/api/recettes-petrolieres-pages";
import { listerPeriodes } from "@/portails/Sof/api/referentiel";
import {
  formaterSelonUnite,
  type UniteMontant,
} from "@/portails/Sof/lib/unite-montant";
import type { PeriodeSof } from "@/portails/Sof/types/referentiel.interface";
import { useAuth } from "@/shared/hooks/use-auth";
import { cn } from "@/shared/lib/utils";

const champCls =
  "h-[34px] rounded-md border border-[#cbd5e1] bg-white px-2.5 text-[13px] text-[#0f172a] outline-none";

export default function ConsolidationPetrole() {
  const { hasAnyRole } = useAuth();
  const estChef = hasAnyRole(["CHEF_SOF"]);

  const [periodes, setPeriodes] = useState<PeriodeSof[]>([]);
  const [periodeId, setPeriodeId] = useState<number | "">("");
  const [unite, setUnite] = useState<UniteMontant>("M");
  const [data, setData] = useState<ConsolidationPage | null>(null);
  const [chargement, setChargement] = useState(true);
  const [enCours, setEnCours] = useState(false);

  useEffect(() => {
    listerPeriodes()
      .then((res) => {
        const liste = [...(res.periodes ?? [])].sort(
          (a, b) => b.exercice_annee - a.exercice_annee || b.mois - a.mois,
        );
        setPeriodes(liste);
        if (liste[0]) setPeriodeId(liste[0].id);
      })
      .catch((e) =>
        toast.error(e instanceof Error ? e.message : "Périodes indisponibles."),
      );
  }, []);

  async function recharger(pid: number) {
    setChargement(true);
    try {
      setData(await obtenirConsolidation(pid));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Chargement impossible.");
    } finally {
      setChargement(false);
    }
  }

  useEffect(() => {
    if (periodeId === "") return;
    void recharger(periodeId);
  }, [periodeId]);

  async function lancerRecalcul() {
    if (!estChef || periodeId === "") return;
    setEnCours(true);
    try {
      const res = await recalculerConsolidation(periodeId);
      setData(res);
      toast.success("Consolidation recalculée (ligne_flechee · montant_mensuel).");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Recalcul impossible.");
    } finally {
      setEnCours(false);
    }
  }

  const lignes = data?.lignes ?? [];
  const alertes = data?.alertes ?? [];

  return (
    <div className="flex flex-col gap-[18px]">
      <SofPageHeader
        title="Consolidation par type"
        description="Montants pétroliers par type, calculés depuis les imports et la qualification des transferts."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              to="/sof/recettes/petrolieres/transferts"
              className="inline-flex h-[38px] items-center rounded-md border border-[#cbd5e1] bg-white px-3.5 text-[13.5px] font-semibold text-[#0f172a] hover:brightness-95"
            >
              Qualification
            </Link>
            <button
              type="button"
              onClick={() => void lancerRecalcul()}
              disabled={!estChef || enCours || periodeId === ""}
              title={estChef ? undefined : "Réservé au Chef SOF"}
              className={cn(
                "inline-flex h-[38px] items-center gap-2 rounded-md border px-3.5 text-[13.5px] font-semibold text-white",
                estChef ? "cursor-pointer" : "cursor-not-allowed opacity-50",
              )}
              style={{ background: "#2a7f62", borderColor: "#2a7f62" }}
            >
              {enCours ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <RefreshCw size={16} />
              )}
              Recalculer
            </button>
          </div>
        }
      />

      <div
        className="flex flex-wrap items-end gap-3 rounded-lg border border-[#e2e8f0] bg-white"
        style={{ padding: "12px 14px" }}
      >
        <label className="flex flex-col gap-1 text-[11px] font-semibold tracking-[0.06em] text-[#64748b] uppercase">
          Période
          <select
            value={periodeId === "" ? "" : String(periodeId)}
            onChange={(e) =>
              setPeriodeId(e.target.value === "" ? "" : Number(e.target.value))
            }
            className={cn(champCls, "min-w-[200px]")}
          >
            {periodes.map((p) => (
              <option key={p.id} value={p.id}>
                {(p.mois_libelle
                  ? p.mois_libelle.charAt(0).toUpperCase() + p.mois_libelle.slice(1)
                  : p.mois) +
                  " " +
                  p.exercice_annee}
              </option>
            ))}
          </select>
        </label>
        <span className="flex-1" />
        <SofUniteSeg value={unite} onChange={setUnite} />
      </div>

      <section className="min-w-0 overflow-hidden rounded-lg border border-[#e2e8f0] bg-white">
        <div
          className="border-b border-[#e2e8f0]"
          style={{ padding: "12px 16px" }}
        >
          <span className="text-[15px] font-semibold text-[#0f172a]">
            Consolidation par type
          </span>
          <p className="text-[12.5px] text-[#64748b]">
            Origine AUTO · tables ligne_flechee / montant_mensuel
          </p>
        </div>
        {chargement ? (
          <div className="flex min-h-[180px] items-center justify-center gap-2 text-[13px] text-[#64748b]">
            <Loader2 size={16} className="animate-spin" /> Chargement…
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div style={{ minWidth: 480 }}>
              <div
                className="grid border-b border-[#e2e8f0] bg-[#f8fafc]"
                style={{ gridTemplateColumns: "minmax(220px, 2fr) 180px" }}
              >
                <div className="px-2.5 py-[9px] text-[11px] font-semibold tracking-[0.05em] text-[#64748b] uppercase">
                  Type
                </div>
                <div className="px-2.5 py-[9px] text-right text-[11px] font-semibold tracking-[0.05em] text-[#64748b] uppercase">
                  Montant
                </div>
              </div>
              {lignes.map((l) => (
                <div
                  key={l.type}
                  className="grid min-h-[42px] border-b border-[#eef2f4] text-[13px]"
                  style={{ gridTemplateColumns: "minmax(220px, 2fr) 180px" }}
                >
                  <div className="flex items-center px-2.5 py-1.5 font-medium">
                    {l.type_libelle}
                  </div>
                  <div
                    className="flex items-center justify-end px-2.5 py-1.5"
                    style={{
                      fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
                    }}
                  >
                    {formaterSelonUnite(l.montant, unite)}
                  </div>
                </div>
              ))}
              <div
                className="grid min-h-[44px] border-t border-[#e2e8f0] bg-[#f8fafc] text-[13px] font-semibold"
                style={{ gridTemplateColumns: "minmax(220px, 2fr) 180px" }}
              >
                <div className="flex items-center px-2.5 py-1.5">Total</div>
                <div
                  className="flex items-center justify-end px-2.5 py-1.5"
                  style={{
                    fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
                  }}
                >
                  {formaterSelonUnite(data?.total ?? "0", unite)}
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="min-w-0 overflow-hidden rounded-lg border border-[#e2e8f0] bg-white">
        <div
          className="border-b border-[#e2e8f0]"
          style={{ padding: "12px 16px" }}
        >
          <span className="text-[15px] font-semibold text-[#0f172a]">
            Alertes
          </span>
          <p className="text-[12.5px] text-[#64748b]">
            Doublons et montants sans justificatif
          </p>
        </div>
        {alertes.length === 0 ? (
          <div className="px-4 py-5 text-[13.5px] text-[#64748b]">
            Aucune alerte.
          </div>
        ) : (
          <ul className="divide-y divide-[#eef2f4]">
            {alertes.map((a, i) => (
              <li
                key={`${a.ig_operation_id}-${i}`}
                className="flex flex-wrap items-start justify-between gap-3 px-4 py-3"
              >
                <div>
                  <div className="text-[13.5px] font-semibold text-[#0f172a]">
                    {a.titre}
                  </div>
                  <div className="text-[12.5px] text-[#64748b]">{a.detail}</div>
                </div>
                <span
                  className="inline-flex h-[22px] items-center rounded-full px-2 text-[11.5px] font-semibold"
                  style={{ background: "#ffe4e6", color: "#be123c" }}
                >
                  À traiter
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
