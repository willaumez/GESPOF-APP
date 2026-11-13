import { useEffect, useState } from "react";
import { Check, FileDown, Loader2, Lock, Unlock } from "lucide-react";
import { toast } from "sonner";
import { SofPageHeader } from "@/portails/Sof/components/layout/SofPageHeader";
import { CardShell, SOF_VERT } from "@/portails/Sof/components/SofCards";
import {
  obtenirControlesPeriode,
  publierPeriode,
  rouvrirPeriode,
  telechargerExportPeriode,
  validerPeriode,
  type ControlesPeriode,
} from "@/portails/Sof/api/validation";
import { usePeriode } from "@/portails/Sof/hooks/PeriodeContext";
import { useAuth } from "@/shared/hooks/use-auth";

/**
 * Validation et clôture SROT — SPEC §9 (Lot 7).
 */
export default function ValidationCloture() {
  const { hasAnyRole } = useAuth();
  const estChef = hasAnyRole(["CHEF_SOF"]);
  const { periodeSof } = usePeriode();
  const [data, setData] = useState<ControlesPeriode | null>(null);
  const [chargement, setChargement] = useState(true);
  const [enCours, setEnCours] = useState(false);

  async function charger() {
    setChargement(true);
    try {
      const res = await obtenirControlesPeriode(periodeSof?.id ?? null);
      setData(res);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Chargement impossible.");
      setData(null);
    } finally {
      setChargement(false);
    }
  }

  useEffect(() => {
    void charger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodeSof?.id]);

  async function onValider() {
    if (!estChef || !data?.periode.id) return;
    setEnCours(true);
    try {
      const res = await validerPeriode(data.periode.id);
      toast.success(res.message);
      await charger();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Validation refusée.");
    } finally {
      setEnCours(false);
    }
  }

  async function onPublier() {
    if (!estChef || !data?.periode.id) return;
    setEnCours(true);
    try {
      const res = await publierPeriode(data.periode.id);
      toast.success(res.message);
      await charger();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Publication refusée.");
    } finally {
      setEnCours(false);
    }
  }

  async function onRouvrir() {
    if (!estChef || !data?.periode.id) return;
    const motif = window.prompt("Motif de réouverture (obligatoire)");
    if (!motif?.trim()) return;
    setEnCours(true);
    try {
      const res = await rouvrirPeriode(data.periode.id, motif.trim());
      toast.success(res.message);
      await charger();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Réouverture refusée.");
    } finally {
      setEnCours(false);
    }
  }

  async function onExport() {
    if (!data?.periode.id) return;
    try {
      await telechargerExportPeriode(data.periode.id, "html");
      toast.success("Export HTML téléchargé (impression → PDF).");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export impossible.");
    }
  }

  const p = data?.periode;

  return (
    <div className="flex flex-col gap-6">
      <SofPageHeader
        title="Validation et clôture"
        description="Contrôles de fin de mois, validation (archive), publication et export PDF."
        remplace="RD Synthèse Analyse · validation · SPEC §9"
        actions={
          estChef ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={enCours || !data?.peut_valider}
                onClick={() => void onValider()}
                className="inline-flex h-10 items-center gap-1.5 rounded-[10px] border border-[#e2e8f0] bg-white px-3.5 text-sm font-medium disabled:opacity-50"
              >
                {enCours ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Check className="size-4" />
                )}
                Valider
              </button>
              <button
                type="button"
                disabled={enCours || !data?.peut_publier}
                onClick={() => void onPublier()}
                className="inline-flex h-10 items-center gap-1.5 rounded-[10px] px-3.5 text-sm font-semibold text-white disabled:opacity-50"
                style={{
                  background: `linear-gradient(180deg, ${SOF_VERT} 0%, #1e6650 100%)`,
                }}
              >
                <Lock className="size-4" /> Publier
              </button>
              <button
                type="button"
                disabled={enCours || !data?.peut_rouvrir}
                onClick={() => void onRouvrir()}
                className="inline-flex h-10 items-center gap-1.5 rounded-[10px] border border-[#e2e8f0] bg-white px-3.5 text-sm font-medium disabled:opacity-50"
              >
                <Unlock className="size-4" /> Rouvrir
              </button>
              <button
                type="button"
                disabled={!p || (p.statut !== "validee" && p.statut !== "publiee")}
                onClick={() => void onExport()}
                className="inline-flex h-10 items-center gap-1.5 rounded-[10px] border border-[#e2e8f0] bg-white px-3.5 text-sm font-medium disabled:opacity-50"
              >
                <FileDown className="size-4" /> Export PDF
              </button>
            </div>
          ) : null
        }
      />

      <CardShell
        title="Contrôles de clôture"
        sub="Tous les points doivent être verts pour valider"
      >
        {chargement ? (
          <div className="flex min-h-[120px] items-center justify-center gap-2 text-[13px] text-[#64748b]">
            <Loader2 size={16} className="animate-spin" /> Chargement…
          </div>
        ) : (
          <ul className="m-0 space-y-0 p-0">
            {(data?.controles ?? []).map((e) => (
              <li
                key={e.code}
                className="flex items-center justify-between gap-4 border-b border-[#f1f5f9] px-4 py-3 text-sm"
              >
                <div>
                  <div className="text-[#0f172a]">{e.libelle}</div>
                  <div className="mt-0.5 text-[12px] text-[#64748b]">
                    {e.detail}
                  </div>
                </div>
                <span
                  className="shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                  style={{
                    background: e.ok ? "#ecfdf5" : "#fff1f2",
                    color: e.ok ? "#047857" : "#be123c",
                  }}
                >
                  {e.ok ? "OK" : "À faire"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardShell>

      <CardShell
        title="Statut de la période"
        sub="OUVERTE → EN_CONTROLE → VALIDEE → PUBLIEE"
      >
        <div className="p-4 text-sm text-[#475569]">
          {p ? (
            <>
              Période{" "}
              <strong>
                {String(p.mois).padStart(2, "0")}/{p.exercice_annee}
              </strong>{" "}
              · statut <strong>{p.statut_libelle}</strong> ({p.statut}).
              {data?.peut_valider
                ? " Prête à valider."
                : " Validation bloquée tant que les contrôles ne sont pas verts."}
            </>
          ) : (
            "Aucune période."
          )}
        </div>
      </CardShell>
    </div>
  );
}
