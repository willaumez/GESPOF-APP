import { useEffect, useMemo, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { SofPageHeader } from "@/portails/Sof/components/layout/SofPageHeader";
import { SofSeg } from "@/portails/Sof/components/SofSeg";
import { SofUniteSeg } from "@/portails/Sof/components/SofUniteSeg";
import {
  obtenirDepensesAutomatisees,
  type AffichageDepensesAutomatisees,
  type DepensesAutomatiseesAgregeesPage,
  type DepensesAutomatiseesDetailPage,
  type FiltreLignesDepenses,
  type LigneDetailDepenseAutomatisee,
} from "@/portails/Sof/api/depenses-automatisees";
import {
  CardShell,
  MONO,
  SofBarreFiltres,
  SofPeriodeSelect,
  SofTag,
  btnSecondaire,
  champCls,
  thCls,
  usePeriodesSof,
} from "@/portails/Sof/components/SofCards";
import {
  formaterSelonUnite,
  type UniteMontant,
} from "@/portails/Sof/lib/unite-montant";
import { cn } from "@/shared/lib/utils";
import type { DepensesAutomatiseesPageConfig } from "./depensesAutomatiseesConfig";

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

const AGGREGATE_GRID =
  "110px minmax(260px, 1.7fr) repeat(12, minmax(92px, 1fr)) 130px";

function cumulSerie(vals: number[]): number[] {
  let somme = 0;
  return vals.map((v) => {
    somme += v;
    return somme;
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

function estNone(code: string | null | undefined) {
  return !code || code === "NONE";
}

function valeurColonne(
  ligne: LigneDetailDepenseAutomatisee,
  cle: string,
): string | null | undefined {
  const valeur = (ligne as Record<string, unknown>)[cle];
  return valeur == null ? null : String(valeur);
}

export function DepensesAutomatiseesPage({
  config,
}: {
  config: DepensesAutomatiseesPageConfig;
}) {
  const { periodes, periodeId, setPeriodeId, periode } = usePeriodesSof();
  const [vue, setVue] = useState<"agregee" | "detail">("agregee");
  const [affichage, setAffichage] =
    useState<AffichageDepensesAutomatisees>("mois");
  const [unite, setUnite] = useState<UniteMontant>("M");
  const [lignesFilter, setLignesFilter] =
    useState<FiltreLignesDepenses>("toutes");
  const [search, setSearch] = useState("");
  const [code, setCode] = useState("");
  const [titre, setTitre] = useState("");
  const [data, setData] = useState<
    DepensesAutomatiseesAgregeesPage | DepensesAutomatiseesDetailPage | null
  >(null);
  const [chargement, setChargement] = useState(false);
  const cumul = affichage === "cumul";
  const detailData = vue === "detail" ? (data as DepensesAutomatiseesDetailPage | null) : null;
  const aggregateData =
    vue === "agregee" ? (data as DepensesAutomatiseesAgregeesPage | null) : null;

  const codeOptions = useMemo(() => {
    const set = new Set<string>();
    for (const ligne of detailData?.lignes ?? []) {
      if (ligne.code) set.add(ligne.code);
    }
    return ["", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [detailData]);

  const titreOptions = useMemo(() => {
    const set = new Set<string>();
    for (const ligne of detailData?.lignes ?? []) {
      if (ligne.titre) set.add(ligne.titre);
    }
    return ["", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [detailData]);

  const selectedCode = codeOptions.includes(code) ? code : "";
  const selectedTitre = titreOptions.includes(titre) ? titre : "";

  useEffect(() => {
    if (periodeId === "") return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setChargement(true);
    obtenirDepensesAutomatisees({
      page: config.slug,
      periode_id: periodeId,
      vue,
      affichage,
      lignes: lignesFilter,
      search: search || undefined,
      code: selectedCode || undefined,
      titre: config.showTitreFilter ? selectedTitre || undefined : undefined,
    })
      .then(setData)
      .catch((e) =>
        toast.error(e instanceof Error ? e.message : "Chargement impossible."),
      )
      .finally(() => setChargement(false));
  }, [
    affichage,
    config.showTitreFilter,
    config.slug,
    lignesFilter,
    periodeId,
    search,
    selectedCode,
    selectedTitre,
    vue,
  ]);

  const moisCourant = periode?.mois ?? 12;
  const lignesAgregees = aggregateData?.codes ?? [];
  const totauxAgreges = aggregateData?.totaux?.mois?.map(Number) ?? [];
  const totauxAffiches = cumul ? cumulSerie(totauxAgreges) : totauxAgreges;

  return (
    <div className="flex flex-col gap-[18px]">
      <SofPageHeader title={config.title} description={config.description} />

      <SofBarreFiltres>
        <SofPeriodeSelect
          label="Mois"
          periodes={periodes}
          value={periodeId}
          onChange={setPeriodeId}
        />
        <SofSeg
          label="Vue"
          options={[
            { cle: "agregee", libelle: "Vue agrégée" },
            { cle: "detail", libelle: "Vue détail" },
          ]}
          value={vue}
          onChange={(v) => setVue(v as "agregee" | "detail")}
        />
        <SofSeg
          label="Affichage"
          options={[
            { cle: "mois", libelle: "Mois" },
            { cle: "cumul", libelle: "Cumul" },
          ]}
          value={affichage}
          onChange={(v) => setAffichage(v as AffichageDepensesAutomatisees)}
        />
        {vue === "detail" ? (
          <>
            <SofSeg
              label="Lignes"
              options={[
                { cle: "toutes", libelle: "Toutes" },
                { cle: "non-flechees", libelle: "Non fléchées" },
              ]}
              value={lignesFilter}
              onChange={(v) => setLignesFilter(v as FiltreLignesDepenses)}
            />
            <label className="flex flex-col gap-1 text-[11px] font-semibold tracking-[0.06em] text-[#64748b] uppercase">
              Recherche
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={cn(champCls, "min-w-[220px]")}
                placeholder="Titre, nature, libellé…"
              />
            </label>
            <label className="flex flex-col gap-1 text-[11px] font-semibold tracking-[0.06em] text-[#64748b] uppercase">
              Code
              <select
                value={selectedCode}
                onChange={(e) => setCode(e.target.value)}
                className={cn(champCls, "min-w-[150px]")}
              >
                {codeOptions.map((option) => (
                  <option key={option || "all"} value={option}>
                    {option || "Tous"}
                  </option>
                ))}
              </select>
            </label>
            {config.showTitreFilter ? (
              <label className="flex flex-col gap-1 text-[11px] font-semibold tracking-[0.06em] text-[#64748b] uppercase">
                Titre
                <select
                  value={selectedTitre}
                  onChange={(e) => setTitre(e.target.value)}
                  className={cn(champCls, "min-w-[160px]")}
                >
                  {titreOptions.map((option) => (
                    <option key={option || "all"} value={option}>
                      {option || "Tous"}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </>
        ) : null}
        <span className="flex-1" />
        <SofUniteSeg value={unite} onChange={setUnite} />
      </SofBarreFiltres>

      <CardShell
        title={vue === "agregee" ? "Vue agrégée" : "Vue détail"}
        sub={
          data?.message ??
          (vue === "agregee"
            ? `Codes de fléchage par mois${cumul ? " · cumul" : ""}`
            : `${detailData?.nombre_none ?? 0} ligne(s) NONE`)
        }
        headRight={
          <button
            type="button"
            className={btnSecondaire}
            onClick={() => toast("Export bientôt disponible.")}
          >
            <Download size={14} />
            Exporter
          </button>
        }
      >
        {chargement ? (
          <div className="flex min-h-[160px] items-center justify-center gap-2 text-[13px] text-[#64748b]">
            <Loader2 size={16} className="animate-spin" /> Chargement…
          </div>
        ) : vue === "agregee" ? (
          lignesAgregees.length === 0 ? (
            <div className="px-4 py-6 text-center text-[13.5px] text-[#64748b]">
              {aggregateData?.message ?? "Aucune donnée."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <div style={{ minWidth: 1880 }}>
                <div
                  className="grid border-b border-[#e2e8f0] bg-[#f8fafc]"
                  style={{ gridTemplateColumns: AGGREGATE_GRID }}
                >
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

                {lignesAgregees.map((ligne) => {
                  const none = estNone(ligne.code);
                  const moisBruts = ligne.mois.map(Number);
                  const moisAff = cumul ? cumulSerie(moisBruts) : moisBruts;
                  return (
                    <div
                      key={ligne.code}
                      className="grid min-h-[42px] border-b border-[#eef2f4] text-[13px]"
                      style={{
                        gridTemplateColumns: AGGREGATE_GRID,
                        background: none ? "#fef3c7" : undefined,
                      }}
                    >
                      <div className="flex items-center px-2.5 py-2">
                        {none ? (
                          <SofTag ton="ambre">NONE</SofTag>
                        ) : (
                          <span
                            className="font-semibold"
                            style={{ fontFamily: MONO }}
                          >
                            {ligne.code}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center px-2.5 py-2 font-medium text-[#334155]">
                        {ligne.libelle}
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
                    gridTemplateColumns: AGGREGATE_GRID,
                    background: "#e3f1ea",
                    borderTop: "1px solid #bfdccf",
                  }}
                >
                  <div className="flex items-center px-2.5 py-2">Total</div>
                  <div />
                  {totauxAffiches.map((v, i) => (
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
                      totalSelonMode(totauxAffiches, cumul, moisCourant),
                      unite,
                    )}
                  </div>
                </div>
              </div>
            </div>
          )
        ) : detailData?.lignes.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-0">
              <thead className="sticky top-0 z-10 bg-[#f8fafc]">
                <tr>
                  {config.detailColumns.map((col) => (
                    <th
                      key={col.key}
                      className={`${thCls} border-b border-[#e2e8f0] ${
                        col.align === "right" ? "text-right" : "text-left"
                      }`}
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {detailData.lignes.map((ligne, index) => {
                  const none = estNone(ligne.code);
                  return (
                    <tr
                      key={`${ligne.source_id}-${index}`}
                      style={{ background: none ? "#fef3c7" : undefined }}
                    >
                      {config.detailColumns.map((col) => {
                        const valeur = col.render
                          ? col.render(ligne)
                          : valeurColonne(ligne, col.key);
                        const isAmount = col.key === "montant";
                        return (
                          <td
                            key={col.key}
                            className={`border-b border-[#eef2f4] px-2.5 py-2 text-[13px] ${
                              col.align === "right" ? "text-right" : "text-left"
                            }`}
                            style={
                              col.mono || isAmount
                                ? {
                                    fontFamily: MONO,
                                    fontVariantNumeric: "tabular-nums",
                                  }
                                : undefined
                            }
                          >
                            {col.key === "code" && none ? (
                              <SofTag ton="ambre">NONE</SofTag>
                            ) : isAmount ? (
                              formaterSelonUnite(ligne.montant, unite)
                            ) : (
                              (valeur ?? "—")
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-4 py-6 text-center text-[13.5px] text-[#64748b]">
            {detailData?.message ?? "Aucune donnée."}
          </div>
        )}
      </CardShell>
    </div>
  );
}
