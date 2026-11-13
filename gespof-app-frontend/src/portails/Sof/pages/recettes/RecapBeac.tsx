import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { SofPageHeader } from "@/portails/Sof/components/layout/SofPageHeader";
import { SofUniteSeg } from "@/portails/Sof/components/SofUniteSeg";
import { obtenirRecapBeacPage } from "@/portails/Sof/api/recettes-petrolieres-pages";
import type { LigneRecapBeac, RecapBeacSof } from "@/portails/Sof/api/recap-beac";
import { listerPeriodes } from "@/portails/Sof/api/referentiel";
import {
  formaterSelonUnite,
  type UniteMontant,
} from "@/portails/Sof/lib/unite-montant";
import type { PeriodeSof } from "@/portails/Sof/types/referentiel.interface";
import { cn } from "@/shared/lib/utils";

const GRILLE = "90px minmax(240px, 2fr) 130px 160px";
const champCls =
  "h-[34px] rounded-md border border-[#cbd5e1] bg-white px-2.5 text-[13px] text-[#0f172a] outline-none";

function TagNature({ petrole, libelle }: { petrole: boolean; libelle: string }) {
  return (
    <span
      className="inline-flex h-[22px] items-center rounded-full px-2 text-[11.5px] font-semibold"
      style={
        petrole
          ? { background: "#ecfdf5", color: "#047857" }
          : { background: "#f1f5f9", color: "#475569" }
      }
    >
      {libelle}
    </span>
  );
}

export default function RecapBeac() {
  const [periodes, setPeriodes] = useState<PeriodeSof[]>([]);
  const [periodeId, setPeriodeId] = useState<number | "">("");
  const [unite, setUnite] = useState<UniteMontant>("M");
  const [data, setData] = useState<RecapBeacSof | null>(null);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    listerPeriodes()
      .then((res) => {
        const liste = [...(res.periodes ?? [])].sort(
          (a, b) =>
            b.exercice_annee - a.exercice_annee || b.mois - a.mois,
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
      setData(await obtenirRecapBeacPage(pid));
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

  const lignes = data?.lignes ?? [];
  const periodeSel = useMemo(
    () => periodes.find((p) => p.id === periodeId),
    [periodes, periodeId],
  );

  return (
    <div className="flex flex-col gap-[18px]">
      <SofPageHeader
        title="Récapitulatif BEAC"
        description="Recettes reçues sur le compte BEAC pour la période, par code et type de recette. Calculées depuis l'import F7."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              to="/sof/imports/extractions?onglet=ig-operations&preset=ig-petrole-1812-201"
              className="inline-flex h-[38px] items-center rounded-md border border-[#cbd5e1] bg-white px-3.5 text-[13.5px] font-semibold text-[#0f172a] hover:brightness-95"
            >
              Import IG
            </Link>
            <button
              type="button"
              onClick={() => periodeId !== "" && void recharger(periodeId)}
              disabled={chargement || periodeId === ""}
              className="inline-flex h-[38px] items-center gap-2 rounded-md border border-[#cbd5e1] bg-white px-3.5 text-[13.5px] font-semibold text-[#0f172a] hover:brightness-95 disabled:opacity-50"
            >
              {chargement ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <RefreshCw size={16} />
              )}
              Rafraîchir
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
        {periodeSel?.date_situation ? (
          <span className="pb-2 text-[12.5px] text-[#64748b]">
            Situation · {periodeSel.date_situation.split("-").reverse().join("/")}
          </span>
        ) : null}
        <span className="flex-1" />
        <SofUniteSeg value={unite} onChange={setUnite} />
      </div>

      <section className="min-w-0 overflow-hidden rounded-lg border border-[#e2e8f0] bg-white">
        <div
          className="border-b border-[#e2e8f0]"
          style={{ padding: "12px 16px" }}
        >
          <span className="text-[15px] font-semibold text-[#0f172a]">
            Récapitulatif BEAC
          </span>
          <p className="text-[12.5px] text-[#64748b]">
            {data?.lot
              ? `Lot ${data.lot.reference} · ${data.nombre} ligne(s) · table recap_beac`
              : (data?.message ?? "Aucun import BEAC")}
          </p>
        </div>
        {chargement ? (
          <div className="flex min-h-[200px] items-center justify-center gap-2 text-[13px] text-[#64748b]">
            <Loader2 size={16} className="animate-spin" /> Chargement…
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div style={{ minWidth: 640 }}>
              <div
                className="grid border-b border-[#e2e8f0] bg-[#f8fafc]"
                style={{ gridTemplateColumns: GRILLE }}
              >
                {(["Code", "Type de recette", "Nature", "Montant"] as const).map(
                  (l, i) => (
                    <div
                      key={l}
                      className="px-2.5 py-[9px] text-[11px] font-semibold tracking-[0.05em] text-[#64748b] uppercase"
                      style={{
                        display: "flex",
                        justifyContent: i === 3 ? "flex-end" : "flex-start",
                        alignItems: "center",
                      }}
                    >
                      {l}
                    </div>
                  ),
                )}
              </div>
              {lignes.length === 0 ? (
                <div className="px-4 py-6 text-center text-[13.5px] text-[#64748b]">
                  {data?.message ?? "Aucune ligne."}
                </div>
              ) : (
                lignes.map((l: LigneRecapBeac) => (
                  <div
                    key={l.id}
                    className="grid min-h-[42px] border-b border-[#eef2f4] text-[13px]"
                    style={{
                      gridTemplateColumns: GRILLE,
                      background: l.petrole ? "#f0f7f4" : undefined,
                    }}
                  >
                    <div
                      className="flex items-center px-2.5 py-1.5"
                      style={{
                        fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
                        fontWeight: l.petrole ? 600 : 400,
                      }}
                    >
                      {l.code}
                    </div>
                    <div
                      className="flex items-center px-2.5 py-1.5"
                      style={{ fontWeight: l.petrole ? 600 : 400 }}
                    >
                      {l.type_recette}
                    </div>
                    <div className="flex items-center px-2.5 py-1.5">
                      <TagNature petrole={l.petrole} libelle={l.nature} />
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
                ))
              )}
              {lignes.length > 0 ? (
                <div
                  className="grid min-h-[44px] border-t border-[#e2e8f0] bg-[#f8fafc] text-[13px] font-semibold"
                  style={{ gridTemplateColumns: GRILLE }}
                >
                  <div className="flex items-center px-2.5 py-1.5">Total</div>
                  <div />
                  <div />
                  <div
                    className="flex items-center justify-end px-2.5 py-1.5"
                    style={{
                      fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
                    }}
                  >
                    {formaterSelonUnite(data?.total ?? "0", unite)}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        )}
      </section>
      <p className="text-[12.5px] text-[#64748b]">
        Lignes pétrolières mises en avant
      </p>
    </div>
  );
}
