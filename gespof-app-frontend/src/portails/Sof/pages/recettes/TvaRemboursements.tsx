import { useEffect, useMemo, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { SofPageHeader } from "@/portails/Sof/components/layout/SofPageHeader";
import { SofSeg } from "@/portails/Sof/components/SofSeg";
import { SofUniteSeg } from "@/portails/Sof/components/SofUniteSeg";
import {
  CardShell,
  MONO,
  SofBarreFiltres,
  SofPeriodeSelect,
  thCls,
  usePeriodesSof,
} from "@/portails/Sof/components/SofCards";
import {
  obtenirRemboursementsTva,
  recalculerRemboursementsTvaSrot,
  type BlocRemboursementsTva,
  type PerimetreTva,
  type RemboursementsTvaPage,
} from "@/portails/Sof/api/recettes-tva";
import {
  formaterSelonUnite,
  type UniteMontant,
} from "@/portails/Sof/lib/unite-montant";
import { useAuth } from "@/shared/hooks/use-auth";

const MOIS_ABR = [
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
] as const;

const GRILLE = "minmax(240px, 2fr) repeat(12, minmax(92px, 1fr)) 130px";

/** Ventile un bloc de mandats par mois (REG IG ; date de règlement, à défaut d'émission). */
function ventilerParMois(
  bloc: BlocRemboursementsTva | undefined,
  petrole: boolean,
): number[] {
  const out = Array<number>(12).fill(0);
  for (const l of bloc?.lignes ?? []) {
    if (l.petrole !== petrole) continue;
    const date = l.dat_regl ?? l.d_emis;
    const mois = date ? Number(date.split("-")[1]) : NaN;
    if (mois >= 1 && mois <= 12) {
      out[mois - 1] += Number(l.reg ?? l.montant ?? 0);
    }
  }
  return out;
}

function cumulSerie(vals: number[]): number[] {
  let s = 0;
  return vals.map((v) => {
    s += v;
    return s;
  });
}

function totalSelonMode(vals: number[], cumul: boolean, moisCourant: number): number {
  const borne = vals.slice(0, Math.max(0, Math.min(12, moisCourant)));
  if (!cumul) return borne.reduce((a, b) => a + b, 0);
  return borne[borne.length - 1] ?? 0;
}

export default function TvaRemboursements() {
  const { periodes, periodeId, setPeriodeId, periode } = usePeriodesSof();
  const { hasAnyRole } = useAuth();
  const estChef = hasAnyRole(["CHEF_SOF"]);
  const [unite, setUnite] = useState<UniteMontant>("M");
  const [affichage, setAffichage] = useState<"mois" | "cumul">("mois");
  const [perimetre, setPerimetre] = useState<PerimetreTva>("petrole");
  const [data, setData] = useState<RemboursementsTvaPage | null>(null);
  const [chargement, setChargement] = useState(false);
  const [recalc, setRecalc] = useState(false);
  const cumul = affichage === "cumul";

  useEffect(() => {
    if (periodeId === "") return;
    setChargement(true);
    obtenirRemboursementsTva({ periodeId, perimetre })
      .then(setData)
      .catch((e) =>
        toast.error(e instanceof Error ? e.message : "Chargement impossible."),
      )
      .finally(() => setChargement(false));
  }, [periodeId, perimetre]);

  const petrole = perimetre === "petrole";
  const moisCourant = periode?.mois ?? 12;
  const arrieres = useMemo(() => {
    const m = ventilerParMois(data?.arrieres, petrole);
    return cumul ? cumulSerie(m) : m;
  }, [data, petrole, cumul]);
  const courants = useMemo(() => {
    const m = ventilerParMois(data?.courants, petrole);
    return cumul ? cumulSerie(m) : m;
  }, [data, petrole, cumul]);
  const totaux = arrieres.map((v, i) => v + courants[i]);
  const libPerimetre = petrole ? "Pétrole" : "Hors pétrole";

  const codeArr = data?.codes?.arriere ?? data?.arrieres?.code_srot ?? "401";
  const codeCou = data?.codes?.courant ?? data?.courants?.code_srot ?? "400";
  const lignesGrille = [
    {
      cle: "arr",
      libelle: `Arriérés · code ${codeArr} (émis hors exercice)`,
      v: arrieres,
    },
    { cle: "cou", libelle: `Courants · code ${codeCou}`, v: courants },
  ];

  async function onRecalculerSrot() {
    if (!estChef || periodeId === "") return;
    setRecalc(true);
    try {
      const res = await recalculerRemboursementsTvaSrot(Number(periodeId));
      setData(res.remboursements);
      toast.success(
        `SROT 400/401 · ${res.srot.nb_lignes} cellules · ${res.srot.total_400} / ${res.srot.total_401} FCFA.`,
      );
      if (res.srot.ig_doublons?.length) {
        toast.message(
          `${res.srot.ig_doublons.length} IG apparié(s) plusieurs fois.`,
        );
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Recalcul SROT impossible.");
    } finally {
      setRecalc(false);
    }
  }

  return (
    <div className="flex flex-col gap-[18px]">
      <SofPageHeader
        title="Remboursements (arriérés / courants)"
        description="Mandats DC appariés IG uniquement (REG). Codes SROT 400 courant / 401 arriéré."
        remplace="Analyse TVA.xlsm · RD Model › Analyse TVA"
        actions={
          estChef ? (
            <button
              type="button"
              disabled={recalc || periodeId === ""}
              onClick={() => void onRecalculerSrot()}
              className="inline-flex h-[38px] items-center gap-2 rounded-md border border-[#cbd5e1] bg-white px-3.5 text-[13.5px] font-semibold text-[#0f172a] hover:brightness-95 disabled:opacity-50"
            >
              {recalc ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <RefreshCw size={16} />
              )}
              Persister 400 / 401
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
        <SofSeg
          label="Périmètre"
          options={[
            { cle: "petrole", libelle: "Pétrole" },
            { cle: "hors-petrole", libelle: "Hors pétrole" },
          ]}
          value={perimetre}
          onChange={(c) => setPerimetre(c as PerimetreTva)}
        />
        <SofSeg
          label="Affichage"
          options={[
            { cle: "mois", libelle: "Mois" },
            { cle: "cumul", libelle: "Cumul" },
          ]}
          value={affichage}
          onChange={(c) => setAffichage(c as "mois" | "cumul")}
        />
        <span className="flex-1" />
        <SofUniteSeg value={unite} onChange={setUnite} />
      </SofBarreFiltres>

      <CardShell
        title={`Remboursements · ${libPerimetre}`}
        sub={
          data?.message ??
          `Mois > période en cours grisés${cumul ? " · cumul" : ""}`
        }
      >
        {chargement ? (
          <div className="flex min-h-[160px] items-center justify-center gap-2 text-[13px] text-[#64748b]">
            <Loader2 size={16} className="animate-spin" /> Chargement…
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div style={{ minWidth: 1560 }}>
              <div
                className="grid border-b border-[#e2e8f0] bg-[#f8fafc]"
                style={{ gridTemplateColumns: GRILLE }}
              >
                <div className={`${thCls} text-left`}>Statut</div>
                {MOIS_ABR.map((m, i) => (
                  <div
                    key={m}
                    className={`${thCls} text-right`}
                    style={{ opacity: i + 1 > moisCourant ? 0.45 : 1 }}
                  >
                    {m}
                  </div>
                ))}
                <div className={`${thCls} text-right`}>
                  {cumul ? "Cumul" : "Total"}
                </div>
              </div>

              {lignesGrille.map((l) => (
                <div
                  key={l.cle}
                  className="grid min-h-[42px] border-b border-[#eef2f4] text-[13px]"
                  style={{ gridTemplateColumns: GRILLE }}
                >
                  <div className="flex items-center px-2.5 py-2 font-medium">
                    {l.libelle}
                  </div>
                  {l.v.map((v, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-end px-2.5 py-2"
                      style={{
                        fontFamily: MONO,
                        fontVariantNumeric: "tabular-nums",
                        color: i + 1 > moisCourant ? "#94a3b8" : "#0f172a",
                      }}
                    >
                      {formaterSelonUnite(v, unite)}
                    </div>
                  ))}
                  <div
                    className="flex items-center justify-end px-2.5 py-2 font-semibold"
                    style={{
                      fontFamily: MONO,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {formaterSelonUnite(
                      totalSelonMode(l.v, cumul, moisCourant),
                      unite,
                    )}
                  </div>
                </div>
              ))}

              <div
                className="grid min-h-[42px] text-[13px] font-semibold"
                style={{
                  gridTemplateColumns: GRILLE,
                  background: "#e3f1ea",
                  borderTop: "1px solid #bfdccf",
                }}
              >
                <div className="flex items-center px-2.5 py-2">Total</div>
                {totaux.map((v, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-end px-2.5 py-2"
                    style={{
                      fontFamily: MONO,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {formaterSelonUnite(v, unite)}
                  </div>
                ))}
                <div
                  className="flex items-center justify-end px-2.5 py-2"
                  style={{
                    fontFamily: MONO,
                    fontVariantNumeric: "tabular-nums",
                    color: "#14533f",
                  }}
                >
                  {formaterSelonUnite(
                    totalSelonMode(totaux, cumul, moisCourant),
                    unite,
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </CardShell>
    </div>
  );
}
