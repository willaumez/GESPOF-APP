import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Loader2,
  Save,
} from "lucide-react";
import { toast } from "sonner";
import { SofPageHeader } from "@/portails/Sof/components/layout/SofPageHeader";
import { SofSeg } from "@/portails/Sof/components/SofSeg";
import { SofUniteSeg } from "@/portails/Sof/components/SofUniteSeg";
import {
  CardShell,
  MONO,
  SOF_VERT,
  SofBarreFiltres,
  SofPeriodeSelect,
  btnPrimaire,
  btnSecondaire,
  thCls,
  usePeriodesSof,
} from "@/portails/Sof/components/SofCards";
import {
  enregistrerFiscalesMode,
  obtenirFiscalesMode,
  type FiscalesModePage,
  type LigneFiscaleMode,
  type ModeRecouvrement,
  type SerieMois,
} from "@/portails/Sof/api/recettes-fiscales";
import {
  formaterSelonUnite,
  parseMontant,
  versFcfa,
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

const GRILLE = "minmax(240px, 2fr) repeat(12, minmax(92px, 1fr)) 130px";

const MODES_CODES: ModeRecouvrement[] = [
  "ETAX",
  "SWIFT",
  "NUMERAIRE",
  "BANCAIRE",
];

function zeros(): number[] {
  return Array.from({ length: 12 }, () => 0);
}

function serieNums(s: SerieMois | undefined): number[] {
  const out = zeros();
  for (let i = 0; i < 12; i++) out[i] = parseMontant(s?.[i] ?? "0");
  return out;
}

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

const cle = (code: string, moisIdx: number) => `${code}|${moisIdx}`;

export default function FiscalesMode() {
  const { hasAnyRole } = useAuth();
  const estChef = hasAnyRole(["CHEF_SOF"]);
  const { periodes, periodeId, setPeriodeId, periode } = usePeriodesSof();

  const [unite, setUnite] = useState<UniteMontant>("M");
  const [affichage, setAffichage] = useState<"mois" | "cumul">("mois");
  const [data, setData] = useState<FiscalesModePage | null>(null);
  const [chargement, setChargement] = useState(false);
  const [enCours, setEnCours] = useState(false);
  /** FCFA saisis : rubrique|moisIdx (0..11) — total ligne (tous modes). */
  const [brouillons, setBrouillons] = useState<Record<string, string>>({});
  const [edition, setEdition] = useState<Record<string, string>>({});
  const [replie, setReplie] = useState<Record<string, boolean>>({});
  const [modesReplies, setModesReplies] = useState(false);
  const [lignesReplies, setLignesReplies] = useState(false);

  const cumul = affichage === "cumul";
  const moisCourant = periode?.mois ?? 12;

  const charger = useCallback(async (pid: number) => {
    setChargement(true);
    try {
      setData(await obtenirFiscalesMode(pid));
      setBrouillons({});
      setEdition({});
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Chargement impossible.");
    } finally {
      setChargement(false);
    }
  }, []);

  useEffect(() => {
    if (periodeId === "") return;
    void charger(periodeId);
  }, [periodeId, charger]);

  const lignes = useMemo(() => data?.lignes ?? [], [data]);
  const sale = Object.keys(brouillons).length > 0;

  const estFeuille = useMemo(
    () =>
      lignes.map((l, i) => {
        const suivante = lignes[i + 1];
        return !suivante || suivante.niveau <= l.niveau;
      }),
    [lignes],
  );

  function serieLigneBrute(l: LigneFiscaleMode): number[] {
    const base = serieNums(l.mois);
    return base.map((v, i) => {
      const k = cle(l.rubrique_code, i);
      return brouillons[k] !== undefined ? parseMontant(brouillons[k]) : v;
    });
  }

  /** Séries affichées (mois ou cumul) — parents = somme des feuilles. */
  const seriesLignes = useMemo(() => {
    const brutes = lignes.map((l, i) =>
      estFeuille[i] ? serieLigneBrute(l) : zeros(),
    );
    for (let i = 0; i < lignes.length; i++) {
      if (estFeuille[i]) continue;
      const s = zeros();
      for (let j = i + 1; j < lignes.length; j++) {
        if (lignes[j].niveau <= lignes[i].niveau) break;
        if (!estFeuille[j]) continue;
        for (let m = 0; m < 12; m++) s[m] += brutes[j][m];
      }
      brutes[i] = s;
    }
    return brutes.map((b) => (cumul ? cumulSerie(b) : b));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lignes, estFeuille, brouillons, cumul]);

  const modesSeries = useMemo(() => {
    return (data?.modes_lignes ?? []).map((m) => {
      const brute = serieNums(m.mois);
      // Saisie ligne = total → à l'enregistrement tout passe sur e-Tax.
      if (m.code === "ETAX") {
        for (let i = 0; i < lignes.length; i++) {
          if (!estFeuille[i]) continue;
          const totalApi = serieNums(lignes[i].mois);
          for (let mois = 0; mois < 12; mois++) {
            const k = cle(lignes[i].rubrique_code, mois);
            if (brouillons[k] !== undefined) {
              brute[mois] += parseMontant(brouillons[k]) - totalApi[mois];
            }
          }
        }
      }
      return {
        ...m,
        v: cumul ? cumulSerie(brute) : brute,
        brute,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, lignes, estFeuille, brouillons, cumul]);

  /** Total Lignes DGI (tous modes). */
  const totauxLignesBruts = useMemo(() => {
    const t = zeros();
    for (let i = 0; i < lignes.length; i++) {
      if (!estFeuille[i]) continue;
      const s = serieLigneBrute(lignes[i]);
      for (let m = 0; m < 12; m++) t[m] += s[m];
    }
    return t;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lignes, estFeuille, brouillons]);

  const totauxLignesAff = cumul
    ? cumulSerie(totauxLignesBruts)
    : totauxLignesBruts;

  /** Total tous modes (section Modes de recouvrement). */
  const totauxTousModesAff = useMemo(() => {
    const t = zeros();
    for (const m of modesSeries) {
      for (let i = 0; i < 12; i++) t[i] += m.brute[i];
    }
    return cumul ? cumulSerie(t) : t;
  }, [modesSeries, cumul]);

  const visibles = useMemo(() => {
    if (lignesReplies) return [];
    const out: number[] = [];
    let hideUnder: number | null = null;
    for (let i = 0; i < lignes.length; i++) {
      const l = lignes[i];
      if (hideUnder !== null) {
        if (l.niveau > hideUnder) continue;
        hideUnder = null;
      }
      out.push(i);
      if (!estFeuille[i] && replie[l.rubrique_code]) hideUnder = l.niveau;
    }
    return out;
  }, [lignes, estFeuille, replie, lignesReplies]);

  function texteChamp(code: string, moisIdx: number, brut: number): string {
    const k = cle(code, moisIdx);
    if (edition[k] !== undefined) return edition[k];
    return formaterSelonUnite(brut, unite);
  }

  async function enregistrer(valider = false) {
    if (!estChef || periodeId === "") return;
    // Total ligne → e-Tax = montant, autres modes à 0 (maquette : 1 montant / ligne / mois).
    const lots: Array<{
      rubrique_code: string;
      mode: ModeRecouvrement;
      montant: string;
      mois: number;
    }> = [];
    for (const [k, montant] of Object.entries(brouillons)) {
      const [rubrique_code, moisIdx] = k.split("|");
      const mois = Number(moisIdx) + 1;
      lots.push({ rubrique_code, mode: "ETAX", montant, mois });
      for (const mode of MODES_CODES) {
        if (mode === "ETAX") continue;
        lots.push({ rubrique_code, mode, montant: "0", mois });
      }
    }
    if (lots.length === 0) {
      if (valider) toast.success("Saisie validée.");
      else toast.message("Aucune modification à enregistrer.");
      return;
    }
    setEnCours(true);
    try {
      const res = await enregistrerFiscalesMode({
        periode_id: periodeId,
        lignes: lots,
      });
      setData(res);
      setBrouillons({});
      setEdition({});
      toast.success(valider ? "Saisie validée." : "Saisie enregistrée.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Enregistrement impossible.");
    } finally {
      setEnCours(false);
    }
  }

  function CellMontant({
    valeur,
    moisIdx,
    gras,
  }: {
    valeur: number;
    moisIdx: number;
    gras?: boolean;
  }) {
    const futur = moisIdx + 1 > moisCourant;
    return (
      <div
        className={cn(
          "flex items-center justify-end px-2.5 py-2",
          gras && "font-semibold",
        )}
        style={{
          fontFamily: MONO,
          fontVariantNumeric: "tabular-nums",
          color: futur ? "#94a3b8" : "#0f172a",
        }}
      >
        {formaterSelonUnite(valeur, unite)}
      </div>
    );
  }

  function CellSaisie({
    code,
    moisIdx,
    brut,
  }: {
    code: string;
    moisIdx: number;
    brut: number;
  }) {
    const futur = moisIdx + 1 > moisCourant;
    const k = cle(code, moisIdx);
    if (!estChef || futur) {
      return <CellMontant valeur={brut} moisIdx={moisIdx} />;
    }
    return (
      <div className="flex items-center px-1.5 py-1">
        <input
          type="text"
          inputMode="decimal"
          disabled={enCours}
          value={texteChamp(code, moisIdx, brut)}
          onFocus={() =>
            setEdition((e) => ({
              ...e,
              [k]: formaterSelonUnite(brut, unite),
            }))
          }
          onChange={(e) => {
            const v = e.target.value;
            setEdition((s) => ({ ...s, [k]: v }));
            setBrouillons((b) => ({ ...b, [k]: versFcfa(v, unite) }));
          }}
          onBlur={() =>
            setEdition((s) => {
              const n = { ...s };
              delete n[k];
              return n;
            })
          }
          className="h-[30px] w-full min-w-[72px] rounded border border-[#cbd5e1] bg-white px-1.5 text-right text-[12.5px] outline-none focus:border-[#2a7f62]"
          style={{
            fontFamily: MONO,
            fontVariantNumeric: "tabular-nums",
            background: brouillons[k] !== undefined ? "#f0f7f4" : undefined,
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-[18px]">
      <SofPageHeader
        title="Par mode de recouvrement"
        description="Saisie mensuelle des recettes DGI par mode de recouvrement et par ligne."
        remplace="Feuille « Impôts »"
        actions={
          estChef ? (
            <>
              <button
                type="button"
                disabled={enCours || !sale}
                onClick={() => void enregistrer(false)}
                className={btnSecondaire}
              >
                <Save size={16} />
                Enregistrer
              </button>
              <button
                type="button"
                disabled={enCours || periodeId === ""}
                onClick={() => void enregistrer(true)}
                className={btnPrimaire}
                style={{
                  background: SOF_VERT,
                  border: `1px solid ${SOF_VERT}`,
                }}
              >
                {enCours ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Check size={16} strokeWidth={2.4} />
                )}
                Valider
              </button>
            </>
          ) : null
        }
      />

      <SofBarreFiltres>
        <SofPeriodeSelect
          label="Mois"
          periodes={periodes}
          value={periodeId}
          onChange={setPeriodeId}
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
        title="Recettes DGI"
        sub={
          data?.message ??
          `Saisie mensuelle${cumul ? " · cumul" : ""} · mois > période grisés`
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

              {/* Modes de recouvrement */}
              <div
                className="grid min-h-[42px] border-b border-[#eef2f4] text-[13px] font-semibold"
                style={{ gridTemplateColumns: GRILLE, background: "#f8fafc" }}
              >
                <button
                  type="button"
                  onClick={() => setModesReplies((v) => !v)}
                  className="flex items-center gap-1.5 px-2.5 py-2 text-left select-none"
                  aria-expanded={!modesReplies}
                >
                  <span className="grid size-5 flex-none place-items-center text-[#64748b]">
                    {modesReplies ? (
                      <ChevronRight size={14} />
                    ) : (
                      <ChevronDown size={14} />
                    )}
                  </span>
                  Modes de recouvrement
                </button>
                {totauxTousModesAff.map((v, i) => (
                  <CellMontant key={i} valeur={v} moisIdx={i} gras />
                ))}
                <CellMontant
                  valeur={totalSelonMode(
                    totauxTousModesAff,
                    cumul,
                    moisCourant,
                  )}
                  moisIdx={moisCourant - 1}
                  gras
                />
              </div>
              {!modesReplies
                ? modesSeries.map((m) => (
                    <div
                      key={m.code}
                      className="grid min-h-[42px] border-b border-[#eef2f4] text-[13px]"
                      style={{ gridTemplateColumns: GRILLE }}
                    >
                      <div
                        className="flex items-center px-2.5 py-2 font-medium"
                        style={{ paddingLeft: 28 }}
                      >
                        {m.libelle}
                      </div>
                      {m.v.map((v, i) => (
                        <CellMontant key={i} valeur={v} moisIdx={i} />
                      ))}
                      <CellMontant
                        valeur={totalSelonMode(m.v, cumul, moisCourant)}
                        moisIdx={moisCourant - 1}
                        gras
                      />
                    </div>
                  ))
                : null}

              {/* Lignes DGI */}
              <div
                className="grid min-h-[42px] border-b border-[#eef2f4] text-[13px] font-semibold"
                style={{ gridTemplateColumns: GRILLE, background: "#f8fafc" }}
              >
                <button
                  type="button"
                  onClick={() => setLignesReplies((v) => !v)}
                  className="flex items-center gap-1.5 px-2.5 py-2 text-left select-none"
                  aria-expanded={!lignesReplies}
                >
                  <span className="grid size-5 flex-none place-items-center text-[#64748b]">
                    {lignesReplies ? (
                      <ChevronRight size={14} />
                    ) : (
                      <ChevronDown size={14} />
                    )}
                  </span>
                  Lignes DGI
                </button>
                {totauxLignesAff.map((v, i) => (
                  <CellMontant key={i} valeur={v} moisIdx={i} gras />
                ))}
                <CellMontant
                  valeur={totalSelonMode(totauxLignesAff, cumul, moisCourant)}
                  moisIdx={moisCourant - 1}
                  gras
                />
              </div>

              {lignes.length === 0 && !lignesReplies ? (
                <div className="px-4 py-6 text-center text-[13.5px] text-[#64748b]">
                  {data?.message ?? "Aucune rubrique de recettes fiscales."}
                </div>
              ) : (
                visibles.map((i) => {
                  const l = lignes[i];
                  const feuille = estFeuille[i];
                  const vals = seriesLignes[i] ?? zeros();
                  const brute = serieLigneBrute(l);
                  const ferme = !!replie[l.rubrique_code];
                  return (
                    <div
                      key={l.rubrique_code}
                      className="grid min-h-[42px] border-b border-[#eef2f4] text-[13px]"
                      style={{
                        gridTemplateColumns: GRILLE,
                        background: feuille ? undefined : "#f8fafc",
                        fontWeight: feuille ? 400 : 600,
                      }}
                    >
                      <div
                        className="flex min-w-0 items-center"
                        style={{
                          paddingLeft: 10 + Math.max(0, l.niveau - 1) * 14,
                        }}
                      >
                        {!feuille ? (
                          <button
                            type="button"
                            onClick={() =>
                              setReplie((p) => ({
                                ...p,
                                [l.rubrique_code]: !p[l.rubrique_code],
                              }))
                            }
                            className="flex min-w-0 items-center gap-1.5 px-2.5 py-2 text-left select-none"
                            aria-expanded={!ferme}
                          >
                            <span className="grid size-5 flex-none place-items-center text-[#64748b]">
                              {ferme ? (
                                <ChevronRight size={14} />
                              ) : (
                                <ChevronDown size={14} />
                              )}
                            </span>
                            <span className="truncate">{l.libelle}</span>
                          </button>
                        ) : (
                          <span className="flex min-w-0 items-center gap-1.5 px-2.5 py-2">
                            <span className="size-5 flex-none" />
                            <span className="truncate">{l.libelle}</span>
                          </span>
                        )}
                      </div>
                      {vals.map((v, mi) =>
                        feuille && !cumul ? (
                          <CellSaisie
                            key={mi}
                            code={l.rubrique_code}
                            moisIdx={mi}
                            brut={brute[mi]}
                          />
                        ) : (
                          <CellMontant
                            key={mi}
                            valeur={v}
                            moisIdx={mi}
                            gras={!feuille}
                          />
                        ),
                      )}
                      <CellMontant
                        valeur={totalSelonMode(vals, cumul, moisCourant)}
                        moisIdx={moisCourant - 1}
                        gras
                      />
                    </div>
                  );
                })
              )}

              <div
                className="grid min-h-[42px] text-[13px] font-semibold"
                style={{
                  gridTemplateColumns: GRILLE,
                  background: "#e3f1ea",
                  borderTop: "1px solid #bfdccf",
                }}
              >
                <div className="flex items-center px-2.5 py-2">Total</div>
                {totauxTousModesAff.map((v, i) => (
                  <CellMontant key={i} valeur={v} moisIdx={i} gras />
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
                    totalSelonMode(totauxTousModesAff, cumul, moisCourant),
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
