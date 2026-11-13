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
  SofTag,
  champCls,
  thCls,
  usePeriodesSof,
} from "@/portails/Sof/components/SofCards";
import {
  obtenirRecettesCorrespondants,
  recalculerRecettesCorrespondants,
  type RecettesCorrespondantsPage,
} from "@/portails/Sof/api/correspondants";
import {
  formaterSelonUnite,
  type UniteMontant,
} from "@/portails/Sof/lib/unite-montant";
import { useAuth } from "@/shared/hooks/use-auth";
import { cn } from "@/shared/lib/utils";

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

const GRILLE =
  "140px 90px 70px minmax(180px, 1.4fr) repeat(12, minmax(92px, 1fr)) 130px";

const estNone = (code: string | null) => !code || code === "NONE";

function cumulSerie(vals: number[]): number[] {
  let s = 0;
  return vals.map((v) => {
    s += v;
    return s;
  });
}

function totalSelonMode(
  vals: number[],
  cumul: boolean,
  moisCourant: number,
): number {
  const borne = vals.slice(0, Math.max(0, Math.min(12, moisCourant)));
  if (!cumul) return borne.reduce((a, b) => a + b, 0);
  return borne[borne.length - 1] ?? 0;
}

export default function Correspondants() {
  const { periodes, periodeId, setPeriodeId, periode } = usePeriodesSof();
  const { hasAnyRole } = useAuth();
  const estChef = hasAnyRole(["CHEF_SOF"]);
  const [unite, setUnite] = useState<UniteMontant>("M");
  const [affichage, setAffichage] = useState<"mois" | "cumul">("mois");
  const [categorie, setCategorie] = useState("Toutes");
  const [data, setData] = useState<RecettesCorrespondantsPage | null>(null);
  const [chargement, setChargement] = useState(false);
  const [recalc, setRecalc] = useState(false);
  const cumul = affichage === "cumul";

  useEffect(() => {
    if (periodeId === "") return;
    setChargement(true);
    obtenirRecettesCorrespondants({ periode_id: periodeId })
      .then(setData)
      .catch((e) =>
        toast.error(e instanceof Error ? e.message : "Chargement impossible."),
      )
      .finally(() => setChargement(false));
  }, [periodeId]);

  const lignes = useMemo(() => data?.lignes ?? [], [data]);
  const options = useMemo(
    () => ["Toutes", ...(data?.categories ?? [])],
    [data],
  );
  useEffect(() => {
    if (!options.includes(categorie)) setCategorie("Toutes");
  }, [options, categorie]);

  const visibles =
    categorie === "Toutes"
      ? lignes
      : lignes.filter((l) => l.categorie === categorie);

  const moisCourant = periode?.mois ?? 12;
  const totauxMoisBruts = Array.from({ length: 12 }, (_, i) =>
    visibles.reduce((s, l) => s + Number(l.mois[i] ?? 0), 0),
  );
  const totauxMois = cumul ? cumulSerie(totauxMoisBruts) : totauxMoisBruts;
  const totalAnnee = totalSelonMode(totauxMois, cumul, moisCourant);

  async function onRecalculer() {
    if (!estChef || periodeId === "") return;
    setRecalc(true);
    try {
      const res = await recalculerRecettesCorrespondants({
        periode_id: Number(periodeId),
      });
      setData(res.etat);
      toast.success(
        `Fléchage persisté · ${res.nb_lignes_flechees} lignes · cumul AUTO à jour.`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Recalcul impossible.");
    } finally {
      setRecalc(false);
    }
  }

  return (
    <div className="flex flex-col gap-[18px]">
      <SofPageHeader
        title="Correspondants"
        description="Opérations des correspondants fléchées vers la SROT. Un code NONE signale une opération non fléchée."
        remplace="VBA CorrespondantsR · RD Model › Recettes"
        actions={
          estChef ? (
            <button
              type="button"
              disabled={recalc || periodeId === ""}
              onClick={() => void onRecalculer()}
              className="inline-flex h-[38px] items-center gap-2 rounded-md border border-[#cbd5e1] bg-white px-3.5 text-[13.5px] font-semibold text-[#0f172a] hover:brightness-95 disabled:opacity-50"
            >
              {recalc ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <RefreshCw size={16} />
              )}
              Persister / cumul AUTO
            </button>
          ) : undefined
        }
      />

      <SofBarreFiltres>
        <SofPeriodeSelect
          label="Mois"
          periodes={periodes}
          value={periodeId}
          onChange={setPeriodeId}
        />
        <label className="flex flex-col gap-1 text-[11px] font-semibold tracking-[0.06em] text-[#64748b] uppercase">
          Catégorie
          <select
            value={categorie}
            onChange={(e) => setCategorie(e.target.value)}
            className={cn(champCls, "min-w-[200px]")}
          >
            {options.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </label>
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
        title="Correspondants · recettes"
        sub={
          data?.message ??
          (data?.lot
            ? `Lot ${data.lot.reference} · mois > période grisés${cumul ? " · cumul" : ""}`
            : cumul
              ? "Cumul"
              : undefined)
        }
      >
        {chargement ? (
          <div className="flex min-h-[160px] items-center justify-center gap-2 text-[13px] text-[#64748b]">
            <Loader2 size={16} className="animate-spin" /> Chargement…
          </div>
        ) : visibles.length === 0 ? (
          <div className="px-4 py-6 text-center text-[13.5px] text-[#64748b]">
            {data?.message ?? "Aucun mouvement."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div style={{ minWidth: 1860 }}>
              <div
                className="grid border-b border-[#e2e8f0] bg-[#f8fafc]"
                style={{ gridTemplateColumns: GRILLE }}
              >
                <div className={`${thCls} text-left`}>Catégorie</div>
                <div className={`${thCls} text-left`}>Compte</div>
                <div className={`${thCls} text-left`}>Code</div>
                <div className={`${thCls} text-left`}>Libellé</div>
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

              {visibles.map((l, idx) => {
                const none = estNone(l.rubrique_code);
                const moisBruts = l.mois.map((v) => Number(v ?? 0));
                const moisAff = cumul ? cumulSerie(moisBruts) : moisBruts;
                return (
                  <div
                    key={`${l.categorie}-${l.compte}-${l.libelle}-${idx}`}
                    className="grid min-h-[42px] border-b border-[#eef2f4] text-[13px]"
                    style={{
                      gridTemplateColumns: GRILLE,
                      background: none ? "#fef3c7" : undefined,
                    }}
                  >
                    <div className="flex items-center px-2.5 py-2 text-[#475569]">
                      {l.categorie}
                    </div>
                    <div
                      className="flex items-center px-2.5 py-2"
                      style={{ fontFamily: MONO }}
                    >
                      {l.compte ?? "—"}
                    </div>
                    <div className="flex items-center px-2.5 py-2">
                      {none ? (
                        <SofTag ton="rose">NONE</SofTag>
                      ) : (
                        <span
                          className="font-semibold"
                          style={{ fontFamily: MONO }}
                        >
                          {l.rubrique_code}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center px-2.5 py-2 font-medium">
                      {l.libelle ?? "—"}
                    </div>
                    {moisAff.map((v, i) => (
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
                        totalSelonMode(moisAff, cumul, moisCourant),
                        unite,
                      )}
                    </div>
                  </div>
                );
              })}

              <div
                className="grid min-h-[42px] text-[13px] font-semibold"
                style={{
                  gridTemplateColumns: GRILLE,
                  background: "#e3f1ea",
                  borderTop: "1px solid #bfdccf",
                }}
              >
                <div className="flex items-center px-2.5 py-2">Total</div>
                <div />
                <div />
                <div />
                {totauxMois.map((v, i) => (
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
                  {formaterSelonUnite(totalAnnee, unite)}
                </div>
              </div>
            </div>
          </div>
        )}
      </CardShell>
    </div>
  );
}
