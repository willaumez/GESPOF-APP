import { useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { SofPageHeader } from "@/portails/Sof/components/layout/SofPageHeader";
import {
  CardShell,
  MONO,
  tdCls,
  thCls,
} from "@/portails/Sof/components/SofCards";
import {
  enregistrerHorsSrot,
  obtenirTableauDeBord,
} from "@/portails/Sof/api/rapports";
import { usePeriode } from "@/portails/Sof/hooks/PeriodeContext";
import { formatMontant } from "@/shared/lib/format";

const MOIS_FR = [
  "",
  "Jan.",
  "Fév.",
  "Mars",
  "Avr.",
  "Mai",
  "Juin",
  "Juil.",
  "Août",
  "Sept.",
  "Oct.",
  "Nov.",
  "Déc.",
];

export default function Page() {
  const { periodeSof } = usePeriode();
  const [srot, setSrot] = useState<Record<string, string>>({});
  const [cours, setCours] = useState<
    Array<{ mois: number; brent: string; usd_xaf: string; prevision_lf: string }>
  >([]);
  const [scalars, setScalars] = useState<Record<string, string>>({});
  const [exercice, setExercice] = useState(0);
  const [chargement, setChargement] = useState(true);
  const [enCours, setEnCours] = useState(false);

  useEffect(() => {
    setChargement(true);
    obtenirTableauDeBord(periodeSof?.id ?? null)
      .then((data) => {
        setSrot(data.srot);
        setCours(data.hors_srot.cours);
        setExercice(data.periode.exercice_annee);
        setScalars({
          ota_ressources: data.hors_srot.ota_ressources,
          ota_charges: data.hors_srot.ota_charges,
          tmp_bta: data.hors_srot.tmp_bta,
          pmp_ota: data.hors_srot.pmp_ota,
          pib_nominal: data.hors_srot.pib_nominal,
          debit_t1: data.hors_srot.debits_t1,
          debit_t2: data.hors_srot.debits_t2,
          debit_t3: data.hors_srot.debits_t3,
        });
      })
      .catch((e) =>
        toast.error(e instanceof Error ? e.message : "Chargement impossible."),
      )
      .finally(() => setChargement(false));
  }, [periodeSof?.id]);

  async function sauver() {
    setEnCours(true);
    try {
      const valeurs: Array<{ code: string; mois: number; valeur: string }> = [];
      for (const c of cours) {
        valeurs.push({ code: "brent", mois: c.mois, valeur: c.brent });
        valeurs.push({ code: "usd_xaf", mois: c.mois, valeur: c.usd_xaf });
      }
      for (const [code, valeur] of Object.entries(scalars)) {
        valeurs.push({ code, mois: 0, valeur });
      }
      await enregistrerHorsSrot({ exercice, valeurs });
      toast.success("Données hors SROT enregistrées.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Enregistrement impossible.");
    } finally {
      setEnCours(false);
    }
  }

  if (chargement) {
    return (
      <div className="flex min-h-[240px] items-center justify-center gap-2 text-[13px] text-[#64748b]">
        <Loader2 size={16} className="animate-spin" /> Chargement…
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <SofPageHeader
        title="Tableau de bord des opérations du Trésor"
        description="Chiffres de la SROT, complétés des données externes (SCR)."
        remplace="Données Rapports.xlsm · SPEC §11"
        actions={
          <button
            type="button"
            disabled={enCours}
            onClick={() => void sauver()}
            className="inline-flex h-10 items-center gap-1.5 rounded-[10px] border border-[#e2e8f0] bg-white px-3.5 text-sm font-medium disabled:opacity-50"
          >
            <Save className="size-4" /> Enregistrer hors SROT
          </button>
        }
      />

      <CardShell title="Indicateurs SROT" sub={`Mode ${srot.mode ?? "—"}`}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 p-2">
          {[
            ["Recettes", srot.recettes],
            ["Dépenses", srot.depenses],
            ["Solde", srot.solde],
            ["Financement", srot.financement],
            ["Équilibre J", srot.equilibre],
          ].map(([l, v]) => (
            <div key={l} className="rounded-lg border border-[#e2e8f0] p-3">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-[#64748b]">
                {l}
              </div>
              <div className="mt-1 text-[15px] font-semibold" style={{ fontFamily: MONO }}>
                {formatMontant(Number(v) || 0)}
              </div>
            </div>
          ))}
        </div>
      </CardShell>

      <CardShell title="Cours du Brent et USD / XAF" sub="6 derniers mois">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-[#e2e8f0] bg-[#f8fafc]">
              <th className={thCls}>Mois</th>
              <th className={thCls} style={{ textAlign: "right" }}>
                Brent (USD)
              </th>
              <th className={thCls} style={{ textAlign: "right" }}>
                Prévision LF
              </th>
              <th className={thCls} style={{ textAlign: "right" }}>
                USD / XAF
              </th>
            </tr>
          </thead>
          <tbody>
            {cours.map((c, i) => (
              <tr key={c.mois} className="border-b border-[#f1f5f9]">
                <td className={tdCls}>{MOIS_FR[c.mois] ?? c.mois}</td>
                <td className={tdCls} style={{ textAlign: "right" }}>
                  <input
                    value={c.brent}
                    onChange={(e) => {
                      const next = [...cours];
                      next[i] = { ...c, brent: e.target.value };
                      setCours(next);
                    }}
                    className="h-8 w-[100px] rounded border border-[#e2e8f0] px-2 text-right text-[13px]"
                    style={{ fontFamily: MONO }}
                  />
                </td>
                <td
                  className={tdCls}
                  style={{ textAlign: "right", fontFamily: MONO, color: "#64748b" }}
                >
                  {c.prevision_lf || "72"}
                </td>
                <td className={tdCls} style={{ textAlign: "right" }}>
                  <input
                    value={c.usd_xaf}
                    onChange={(e) => {
                      const next = [...cours];
                      next[i] = { ...c, usd_xaf: e.target.value };
                      setCours(next);
                    }}
                    className="h-8 w-[100px] rounded border border-[#e2e8f0] px-2 text-right text-[13px]"
                    style={{ fontFamily: MONO }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardShell>

      <div className="grid gap-6 lg:grid-cols-2">
        <CardShell title="Utilisation des OTA">
          <div className="flex flex-col gap-2 p-2">
            {[
              ["ota_ressources", "Ressources"],
              ["ota_charges", "Charges"],
            ].map(([k, l]) => (
              <label key={k} className="flex items-center justify-between gap-3 text-[13px]">
                <span>{l}</span>
                <input
                  value={scalars[k] ?? ""}
                  onChange={(e) =>
                    setScalars((s) => ({ ...s, [k]: e.target.value }))
                  }
                  className="h-8 w-[160px] rounded border border-[#e2e8f0] px-2 text-right"
                  style={{ fontFamily: MONO }}
                />
              </label>
            ))}
          </div>
        </CardShell>
        <CardShell title="Taux et prix moyens · PIB · Débits">
          <div className="flex flex-col gap-2 p-2">
            {[
              ["tmp_bta", "TMP BTA (%)"],
              ["pmp_ota", "PMP OTA"],
              ["pib_nominal", "PIB nominal (Md)"],
              ["debit_t1", "Débits T1"],
              ["debit_t2", "Débits T2"],
              ["debit_t3", "Débits T3"],
            ].map(([k, l]) => (
              <label key={k} className="flex items-center justify-between gap-3 text-[13px]">
                <span>{l}</span>
                <input
                  value={scalars[k] ?? ""}
                  onChange={(e) =>
                    setScalars((s) => ({ ...s, [k]: e.target.value }))
                  }
                  className="h-8 w-[140px] rounded border border-[#e2e8f0] px-2 text-right"
                  style={{ fontFamily: MONO }}
                />
              </label>
            ))}
          </div>
        </CardShell>
      </div>
    </div>
  );
}
