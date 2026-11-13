import { useEffect, useState } from "react";
import { Download, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { SofPageHeader } from "@/portails/Sof/components/layout/SofPageHeader";
import { SofSeg } from "@/portails/Sof/components/SofSeg";
import { SofUniteSeg } from "@/portails/Sof/components/SofUniteSeg";
import {
  obtenirVueAnnuelleDouane,
  recalculerVueAnnuelleDouane,
  type VueAnnuelleDouanePage,
} from "@/portails/Sof/api/recettes-douanieres-pages";
import { listerPeriodes } from "@/portails/Sof/api/referentiel";
import {
  formaterSelonUnite,
  libelleUniteCourt,
  type UniteMontant,
} from "@/portails/Sof/lib/unite-montant";
import type { PeriodeSof } from "@/portails/Sof/types/referentiel.interface";
import { useAuth } from "@/shared/hooks/use-auth";
import { cn } from "@/shared/lib/utils";

const SOF_VERT = "#2a7f62";

const champCls =
  "h-[34px] rounded-md border border-[#cbd5e1] bg-white px-2.5 text-[13px] text-[#0f172a] outline-none";

function grille(moisCount: number): string {
  return `120px ${Array.from({ length: moisCount }, () => "112px").join(" ")} 136px`;
}

function sommeSerie(vals: string[]): string {
  return vals
    .reduce((s, x) => {
      const n = Number(
        String(x).replace(/[\s\u00A0\u202F']/g, "").replace(",", "."),
      );
      return Number.isFinite(n) ? s + n : s;
    }, 0)
    .toFixed(2);
}

function cumulSerie(vals: string[]): string[] {
  let s = 0;
  return vals.map((x) => {
    const n = Number(
      String(x).replace(/[\s\u00A0\u202F']/g, "").replace(",", "."),
    );
    if (!Number.isFinite(n)) return "0.00";
    s += n;
    return s.toFixed(2);
  });
}

function totalSelonMode(vals: string[], cumul: boolean): string {
  if (!cumul) return sommeSerie(vals);
  for (let i = vals.length - 1; i >= 0; i--) {
    const n = Number(
      String(vals[i]).replace(/[\s\u00A0\u202F']/g, "").replace(",", "."),
    );
    if (Number.isFinite(n) && n !== 0) return vals[i];
  }
  return vals[vals.length - 1] ?? "0";
}

export default function VueAnnuelleDouanes() {
  const { hasAnyRole } = useAuth();
  const estChef = hasAnyRole(["CHEF_SOF"]);

  const [periodes, setPeriodes] = useState<PeriodeSof[]>([]);
  const [periodeId, setPeriodeId] = useState<number | "">("");
  const [unite, setUnite] = useState<UniteMontant>("M");
  const [affichage, setAffichage] = useState<"mois" | "cumul">("mois");
  const [data, setData] = useState<VueAnnuelleDouanePage | null>(null);
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
      setData(await obtenirVueAnnuelleDouane({ periodeId: pid }));
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

  async function recalculer() {
    if (!estChef || periodeId === "") return;
    setEnCours(true);
    try {
      const res = await recalculerVueAnnuelleDouane(periodeId);
      setData(res);
      toast.success(
        "Vue annuelle recalculée (ligne_flechee · montant_mensuel).",
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Recalcul impossible.");
    } finally {
      setEnCours(false);
    }
  }

  const moisLib = data?.mois_libelles ?? [
    "Janv.",
    "Févr.",
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
  const moisCourant = data?.mois_courant ?? 12;
  const cumul = affichage === "cumul";
  const uL = libelleUniteCourt(unite);
  const gtc = grille(12);

  function montantsAffiches(m: string[]): string[] {
    return cumul ? cumulSerie(m) : m;
  }

  function CellMontant({
    valeur,
    moisIndex,
    gras,
  }: {
    valeur: string | null;
    moisIndex: number;
    gras?: boolean;
  }) {
    const grey = moisIndex + 1 >= moisCourant;
    const vide = valeur == null || Number(valeur) === 0;
    return (
      <div
        className="flex items-center justify-end"
        style={{
          padding: "6px 10px",
          fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
          fontVariantNumeric: "tabular-nums",
          fontWeight: gras ? 600 : 400,
          color: grey ? "#64748b" : vide ? "#94a3b8" : "#0f172a",
          background: grey ? "#f4f6f7" : undefined,
        }}
      >
        {valeur == null ? "—" : formaterSelonUnite(valeur, unite)}
      </div>
    );
  }

  const totauxAff = data
    ? montantsAffiches(data.totaux)
    : Array.from({ length: 12 }, () => "0.00");
  const totalGeneral = data
    ? totalSelonMode(
        data.totaux.map((v, i) => (i + 1 > moisCourant ? "0" : v)),
        cumul,
      )
    : "0";

  return (
    <div className="flex flex-col gap-[18px]">
      <SofPageHeader
        title="Vue annuelle"
        description="Recettes douanières par compte et par mois."
        remplace='Feuille « Douanes »'
        actions={
          <div className="flex flex-wrap gap-2">
            {estChef ? (
              <button
                type="button"
                disabled={enCours || periodeId === ""}
                onClick={() => void recalculer()}
                className="inline-flex h-[38px] items-center gap-2 rounded-md px-3.5 text-[13.5px] font-semibold text-white disabled:opacity-50"
                style={{
                  background: SOF_VERT,
                  border: `1px solid ${SOF_VERT}`,
                }}
              >
                {enCours ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <RefreshCw size={16} />
                )}
                Recalculer
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => toast.message("Export Excel à brancher.")}
              className="inline-flex h-[38px] items-center gap-2 rounded-md border border-[#cbd5e1] bg-white px-3.5 text-[13.5px] font-semibold text-[#0f172a]"
            >
              <Download size={16} />
              Exporter .xlsx
            </button>
          </div>
        }
      />

      <div
        className="flex flex-wrap items-end gap-x-3.5 gap-y-3 rounded-lg border border-[#e2e8f0] bg-white"
        style={{ padding: "12px 14px" }}
      >
        <label className="flex flex-col gap-1 text-[11px] font-semibold tracking-[0.06em] text-[#64748b] uppercase">
          Période (exercice)
          <select
            value={periodeId === "" ? "" : String(periodeId)}
            onChange={(e) =>
              setPeriodeId(e.target.value === "" ? "" : Number(e.target.value))
            }
            className={cn(champCls, "min-w-[180px]")}
          >
            {periodes.map((p) => (
              <option key={p.id} value={p.id}>
                {(p.mois_libelle
                  ? p.mois_libelle.charAt(0).toUpperCase() +
                    p.mois_libelle.slice(1)
                  : p.mois) +
                  " " +
                  p.exercice_annee}
              </option>
            ))}
          </select>
        </label>
        <span className="flex-1" />
        <SofUniteSeg value={unite} onChange={setUnite} />
        <SofSeg
          label="Affichage"
          options={[
            { cle: "mois", libelle: "Mois" },
            { cle: "cumul", libelle: "Cumul" },
          ]}
          value={affichage}
          onChange={(v) => setAffichage(v as "mois" | "cumul")}
        />
      </div>

      <section className="min-w-0 overflow-hidden rounded-lg border border-[#e2e8f0] bg-white">
        <div
          className="border-b border-[#e2e8f0]"
          style={{ padding: "12px 16px" }}
        >
          <span className="text-[15px] font-semibold text-[#0f172a]">
            Vue annuelle
          </span>
          <p className="text-[12.5px] text-[#64748b]">
            Montants en {uL} · mois non clos grisés
            {cumul ? " · cumul" : ""}
            {data?.exercice_annee ? ` · exercice ${data.exercice_annee}` : ""}
          </p>
        </div>

        {chargement ? (
          <div className="flex min-h-[200px] items-center justify-center gap-2 text-[13px] text-[#64748b]">
            <Loader2 size={16} className="animate-spin" /> Chargement…
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div style={{ minWidth: 1480 }}>
              <div
                className="grid border-b border-[#e2e8f0] bg-[#f8fafc]"
                style={{ gridTemplateColumns: gtc }}
              >
                {(
                  [
                    ["Libellé", "flex-start", false],
                    ...moisLib.map((m, i) => [
                      m,
                      "flex-end",
                      i + 1 >= moisCourant,
                    ]),
                    [cumul ? "Cumul" : "Total", "flex-end", false],
                  ] as [string, string, boolean][]
                ).map(([l, jc, grey], i) => (
                  <div
                    key={`${l}-${i}`}
                    className="text-[11px] font-semibold tracking-[0.05em] uppercase"
                    style={{
                      padding: "9px 10px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: jc,
                      color: grey ? "#94a3b8" : "#64748b",
                      background: grey ? "#eef1f2" : undefined,
                    }}
                  >
                    {l}
                  </div>
                ))}
              </div>

              {(data?.lignes ?? []).length === 0 ? (
                <div
                  className="text-center text-[13.5px] text-[#64748b]"
                  style={{ padding: "24px 16px" }}
                >
                  {data?.message ?? "Aucune donnée. Lancez un recalcul."}
                </div>
              ) : (
                (data?.lignes ?? []).map((ligne) => {
                  const vals = montantsAffiches(ligne.montants);
                  const tot = totalSelonMode(
                    ligne.montants.map((v, i) =>
                      i + 1 > moisCourant ? "0" : v,
                    ),
                    cumul,
                  );
                  return (
                    <div
                      key={ligne.compte}
                      className="grid min-h-[42px] border-b border-[#eef2f4] text-[13px]"
                      style={{ gridTemplateColumns: gtc }}
                    >
                      <div
                        className="flex items-center"
                        style={{
                          padding: "6px 10px",
                          fontFamily:
                            '"IBM Plex Mono", ui-monospace, monospace',
                          fontWeight: 500,
                        }}
                      >
                        {ligne.compte}
                      </div>
                      {vals.map((v, i) => (
                        <CellMontant
                          key={i}
                          valeur={i + 1 > moisCourant ? null : v}
                          moisIndex={i}
                        />
                      ))}
                      <CellMontant
                        valeur={tot}
                        moisIndex={moisCourant - 1}
                        gras
                      />
                    </div>
                  );
                })
              )}

              {(data?.lignes ?? []).length > 0 ? (
                <div
                  className="grid min-h-[42px] text-[13px] font-bold"
                  style={{
                    gridTemplateColumns: gtc,
                    background: "#e3f1ea",
                    borderTop: "1px solid #bfdccf",
                    color: "#14533f",
                  }}
                >
                  <div
                    className="flex items-center"
                    style={{ padding: "6px 10px" }}
                  >
                    Total
                  </div>
                  {totauxAff.map((v, i) => (
                    <CellMontant
                      key={i}
                      valeur={i + 1 > moisCourant ? null : v}
                      moisIndex={i}
                      gras
                    />
                  ))}
                  <CellMontant
                    valeur={totalGeneral}
                    moisIndex={moisCourant - 1}
                    gras
                  />
                </div>
              ) : null}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
