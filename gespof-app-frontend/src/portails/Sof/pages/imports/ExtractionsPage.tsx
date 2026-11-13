import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Check,
  Circle,
  ExternalLink,
  History,
  Loader2,
  Minus,
  Play,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { SofPageHeader } from "@/portails/Sof/components/layout/SofPageHeader";
import { usePeriode } from "@/portails/Sof/hooks/PeriodeContext";
import { useAuth } from "@/shared/hooks/use-auth";
import { formatMontant } from "@/shared/lib/format";
import { cn } from "@/shared/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import {
  annulerLancement,
  avancerLancement,
  executerExtractions,
  obtenirDefinitionsExtractions,
  obtenirLancement,
  obtenirStatutsExtractions,
  type ElementLancement,
  type FamilleExtraction,
  type LancementExtraction,
  type PresetDefinition,
  type StatutPreset,
  type SurchargePreset,
} from "@/portails/Sof/api/extractions";

const ACCENT = "#1e6650";

function fmtIsoFr(iso: string | null | undefined): string {
  if (!iso) return "—";
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function fmtPeriode(p: { debut: string | null; fin: string | null }): string {
  if (!p.debut && !p.fin) return "—";
  return `${fmtIsoFr(p.debut)} → ${fmtIsoFr(p.fin)}`;
}

function fmtDuree(s: number): string {
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m <= 0) return `${r} s`;
  return `${m} min ${r.toString().padStart(2, "0")} s`;
}

function SymboleStatut({ statut }: { statut: string }) {
  if (statut === "TERMINE")
    return <Check className="h-3.5 w-3.5 text-emerald-600" strokeWidth={2.5} />;
  if (statut === "EN_COURS")
    return <Loader2 className="h-3.5 w-3.5 animate-spin text-[#1e6650]" />;
  if (statut === "ERREUR")
    return <XCircle className="h-3.5 w-3.5 text-rose-600" />;
  if (statut === "IGNORE" || statut === "ANNULE")
    return <Minus className="h-3.5 w-3.5 text-slate-400" />;
  return <Circle className="h-3 w-3 text-slate-300" />;
}

function libelleStatutLigne(s: string): string {
  switch (s) {
    case "a_jour":
      return "À jour";
    case "a_extraire":
      return "À extraire";
    case "indisponible":
      return "Non disponible";
    case "excel":
      return "Excel uniquement";
    default:
      return s;
  }
}

function couleurStatut(s: string): { bg: string; color: string } {
  switch (s) {
    case "a_jour":
      return { bg: "#ecfdf5", color: "#047857" };
    case "a_extraire":
      return { bg: "#fff7ed", color: "#c2410c" };
    case "indisponible":
    case "excel":
      return { bg: "#f1f5f9", color: "#64748b" };
    default:
      return { bg: "#f1f5f9", color: "#475569" };
  }
}

export default function ExtractionsPage() {
  const { hasAnyRole } = useAuth();
  const estChef = hasAnyRole(["CHEF_SOF"]);
  const { periodeSof } = usePeriode();
  const [searchParams, setSearchParams] = useSearchParams();

  const ongletUrl = searchParams.get("onglet") ?? "ig-operations";
  const presetUrl = searchParams.get("preset");

  const [familles, setFamilles] = useState<FamilleExtraction[]>([]);
  const [presets, setPresets] = useState<PresetDefinition[]>([]);
  const [statuts, setStatuts] = useState<StatutPreset[]>([]);
  const [dateSituation, setDateSituation] = useState("");
  const [dateDebut, setDateDebut] = useState("");
  const [dateFin, setDateFin] = useState("");
  const [exercice, setExercice] = useState<number>(new Date().getFullYear());
  const [filtreSource, setFiltreSource] = useState<"TOUTES" | "IG" | "DC">(
    "TOUTES",
  );
  const [filtreDomaine, setFiltreDomaine] = useState<
    "TOUS" | "RECETTES" | "DEPENSES" | "EXECUTION"
  >("TOUS");
  const [filtreStatut, setFiltreStatut] = useState<
    "TOUS" | "a_extraire" | "a_jour" | "en_erreur"
  >("TOUS");
  const [selection, setSelection] = useState<Record<string, boolean>>({});
  const [presetActif, setPresetActif] = useState<string | null>(presetUrl);
  const [chargement, setChargement] = useState(true);
  const [lancement, setLancement] = useState<LancementExtraction | null>(null);
  const [loaderOuvert, setLoaderOuvert] = useState(false);
  const [enCoursLancement, setEnCoursLancement] = useState(false);
  const [surcharges, setSurcharges] = useState<Record<string, SurchargePreset>>(
    {},
  );
  const datesTouchees = useRef<Set<string>>(new Set());
  const dateSituationInit = useRef(false);
  const dateSituationServeur = useRef<string>("");
  const avancerLock = useRef(false);

  const periodeId = periodeSof?.id ?? null;

  const mapStatuts = useMemo(() => {
    const m = new Map<string, StatutPreset>();
    for (const s of statuts) m.set(s.code, s);
    return m;
  }, [statuts]);

  function appliquerPeriodesCalculees(
    lignes: StatutPreset[],
    forcer = false,
    situationIso?: string,
    exerciceAnnee?: number,
  ) {
    setSurcharges((prev) => {
      const next = { ...prev };
      for (const p of lignes) {
        if (!forcer && datesTouchees.current.has(p.code)) continue;
        next[p.code] = {
          date_debut: p.periode_calculee.debut ?? "",
          date_fin: p.periode_calculee.fin ?? "",
        };
      }
      return next;
    });
    if (forcer || !dateDebut || !dateFin) {
      const sit = situationIso || dateSituation;
      const an = exerciceAnnee ?? exercice;
      if (sit) {
        setDateDebut(`${an}-01-01`);
        setDateFin(sit);
      }
    }
  }

  /** Applique date début/fin communes à tous les presets. */
  function appliquerDatesCommunes(debut: string, fin: string) {
    setDateDebut(debut);
    setDateFin(fin);
    setSurcharges((prev) => {
      const next: Record<string, SurchargePreset> = { ...prev };
      for (const p of presets) {
        datesTouchees.current.add(p.code);
        next[p.code] = { date_debut: debut, date_fin: fin };
      }
      return next;
    });
  }

  const charger = useCallback(
    async (opts?: {
      dateSituation?: string;
      garderDate?: boolean;
      forcerDates?: boolean;
    }) => {
      setChargement(true);
      try {
        const [defs, st] = await Promise.all([
          obtenirDefinitionsExtractions(),
          obtenirStatutsExtractions(
            periodeId,
            opts?.dateSituation ?? undefined,
          ),
        ]);
        setFamilles(defs.familles);
        setPresets(defs.presets);
        setStatuts(st.presets);
        setExercice(st.exercice);
        if (!opts?.garderDate || !dateSituationInit.current) {
          dateSituationServeur.current = st.date_situation;
          setDateSituation(st.date_situation);
          dateSituationInit.current = true;
        }
        appliquerPeriodesCalculees(
          st.presets,
          Boolean(opts?.dateSituation) || opts?.forcerDates === true,
          opts?.garderDate ? opts.dateSituation : st.date_situation,
          st.exercice,
        );
        if (st.lancement_en_cours_id) {
          const lanc = await obtenirLancement(st.lancement_en_cours_id);
          setLancement(lanc);
          setLoaderOuvert(true);
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Chargement impossible.");
      } finally {
        setChargement(false);
      }
    },
    [periodeId],
  );

  useEffect(() => {
    dateSituationInit.current = false;
    datesTouchees.current.clear();
    void charger();
  }, [charger]);

  useEffect(() => {
    if (presetUrl) setPresetActif(presetUrl);
  }, [presetUrl]);

  // Recalcule les périodes si l'agent change la date de situation.
  useEffect(() => {
    if (!dateSituationInit.current || !dateSituation) return;
    if (dateSituation === dateSituationServeur.current) return;
    const t = window.setTimeout(() => {
      datesTouchees.current.clear();
      dateSituationServeur.current = dateSituation;
      void charger({
        dateSituation,
        garderDate: true,
        forcerDates: true,
      });
    }, 400);
    return () => window.clearTimeout(t);
  }, [dateSituation, charger]);

  const presetsFiltres = useMemo(() => {
    return presets.filter((p) => {
      if (filtreSource !== "TOUTES" && p.source !== filtreSource) return false;
      if (filtreDomaine !== "TOUS" && p.domaine !== filtreDomaine) return false;
      const st = mapStatuts.get(p.code)?.statut ?? "a_extraire";
      if (filtreStatut === "a_extraire" && st !== "a_extraire") return false;
      if (filtreStatut === "a_jour" && st !== "a_jour") return false;
      if (filtreStatut === "en_erreur" && st !== "erreur") return false;
      return true;
    });
  }, [presets, filtreSource, filtreDomaine, filtreStatut, mapStatuts]);

  const famillesVisibles = useMemo(() => {
    return familles.filter((f) =>
      presetsFiltres.some((p) => p.famille === f.id),
    );
  }, [familles, presetsFiltres]);

  const onglet =
    famillesVisibles.find((f) => f.id === ongletUrl)?.id ??
    famillesVisibles[0]?.id ??
    "ig-operations";

  const lignesOnglet = useMemo(
    () => presetsFiltres.filter((p) => p.famille === onglet),
    [presetsFiltres, onglet],
  );

  const compteAExtraire = useCallback(
    (familleId: string) =>
      presetsFiltres.filter(
        (p) =>
          p.famille === familleId &&
          (mapStatuts.get(p.code)?.statut ?? "a_extraire") === "a_extraire" &&
          p.disponible,
      ).length,
    [presetsFiltres, mapStatuts],
  );

  function changerOnglet(id: string) {
    const next = new URLSearchParams(searchParams);
    next.set("onglet", id);
    if (presetActif) {
      const encore = presets.find(
        (p) => p.code === presetActif && p.famille === id,
      );
      if (!encore) next.delete("preset");
    }
    setSearchParams(next, { replace: true });
  }

  function selectionnerPreset(code: string) {
    setPresetActif(code);
    const next = new URLSearchParams(searchParams);
    next.set("onglet", onglet);
    next.set("preset", code);
    setSearchParams(next, { replace: true });
  }

  function fermerPreset() {
    setPresetActif(null);
    const next = new URLSearchParams(searchParams);
    next.delete("preset");
    setSearchParams(next, { replace: true });
  }

  const codesVisiblesDispo = useMemo(
    () =>
      presetsFiltres
        .filter((p) => p.disponible && !p.depot_excel_uniquement)
        .map((p) => p.code),
    [presetsFiltres],
  );

  const codesSelectionnes = useMemo(
    () => Object.keys(selection).filter((c) => selection[c]),
    [selection],
  );

  function periodeEffective(code: string): {
    debut: string | null;
    fin: string | null;
  } {
    const s = surcharges[code];
    if (s?.date_debut || s?.date_fin) {
      return { debut: s.date_debut || null, fin: s.date_fin || null };
    }
    return (
      mapStatuts.get(code)?.periode_calculee ?? { debut: null, fin: null }
    );
  }

  function majDatesPreset(
    code: string,
    champ: "date_debut" | "date_fin",
    valeur: string,
  ) {
    datesTouchees.current.add(code);
    setSurcharges((prev) => ({
      ...prev,
      [code]: { ...prev[code], [champ]: valeur },
    }));
  }

  async function lancer(codes: string[]): Promise<boolean> {
    if (!periodeId) {
      toast.error("Sélectionnez une période SROT dans la barre du haut.");
      return false;
    }
    if (codes.length === 0) {
      toast.error("Aucune extraction à lancer.");
      return false;
    }
    const sansDates = codes.filter((c) => {
      const p = periodeEffective(c);
      return !p.debut || !p.fin;
    });
    if (sansDates.length > 0) {
      toast.error(
        `Dates début/fin manquantes pour : ${sansDates.slice(0, 3).join(", ")}${sansDates.length > 3 ? "…" : ""}`,
      );
      return false;
    }
    const payloadSurcharges: Record<string, SurchargePreset> = {};
    for (const c of codes) {
      const p = periodeEffective(c);
      payloadSurcharges[c] = {
        date_debut: p.debut ?? undefined,
        date_fin: p.fin ?? undefined,
      };
    }
    setEnCoursLancement(true);
    try {
      const lanc = await executerExtractions({
        periodeId,
        codes,
        date_situation: dateSituation || undefined,
        surcharges: payloadSurcharges,
      });
      setLancement(lanc);
      setLoaderOuvert(true);
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Lancement impossible.");
      return false;
    } finally {
      setEnCoursLancement(false);
    }
  }

  // Poll + avancer tant que EN_COURS
  useEffect(() => {
    if (!lancement || lancement.statut !== "EN_COURS") return;
    let stop = false;

    async function tick() {
      if (stop || avancerLock.current || !lancement) return;
      avancerLock.current = true;
      try {
        const next = await avancerLancement(lancement.id);
        if (!stop) setLancement(next);
        if (next.statut !== "EN_COURS") {
          void charger();
        }
      } catch (e) {
        if (!stop) {
          toast.error(
            e instanceof Error ? e.message : "Avancement interrompu.",
          );
        }
      } finally {
        avancerLock.current = false;
      }
    }

    void tick();
    const id = window.setInterval(() => {
      void tick();
    }, 1200);
    return () => {
      stop = true;
      window.clearInterval(id);
    };
  }, [lancement?.id, lancement?.statut, charger]);

  async function onAnnuler() {
    if (!lancement) return;
    try {
      const next = await annulerLancement(lancement.id);
      setLancement(next);
      void charger();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Annulation impossible.");
    }
  }

  const presetSelectionne = presets.find((p) => p.code === presetActif) ?? null;
  const statutSelectionne = presetSelectionne
    ? mapStatuts.get(presetSelectionne.code)
    : null;

  const elementsTop = useMemo(() => {
    if (!lancement) return [];
    return lancement.elements.filter((e) => e.parent_id == null);
  }, [lancement]);

  const extractionActive = Boolean(
    lancement &&
      (loaderOuvert || lancement.statut === "EN_COURS"),
  );
  const nbTermines = elementsTop.filter((e) =>
    ["TERMINE", "ERREUR", "IGNORE", "ANNULE"].includes(e.statut),
  ).length;
  const nbOk = elementsTop.filter((e) => e.statut === "TERMINE").length;
  const nbErreur = elementsTop.filter((e) => e.statut === "ERREUR").length;
  const nbIgnore = elementsTop.filter((e) =>
    ["IGNORE", "ANNULE"].includes(e.statut),
  ).length;

  return (
    <div className="flex flex-col gap-5">
      <SofPageHeader
        title="Extractions DC / IG"
        description={
          extractionActive
            ? "Suivi de l’extraction en cours. Les onglets et le tableau sont masqués jusqu’à la fermeture du panneau."
            : "Paramètres communs, sélection des presets et suivi progressif des extractions Oracle."
        }
        actions={
          estChef && !extractionActive ? (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={enCoursLancement || lancement?.statut === "EN_COURS"}
                onClick={() => void lancer(codesSelectionnes)}
                className="inline-flex h-10 items-center gap-2 rounded-[10px] px-4 text-[13.5px] font-semibold text-white disabled:opacity-50"
                style={{
                  background: `linear-gradient(180deg, ${ACCENT} 0%, #0f172a 100%)`,
                }}
              >
                {enCoursLancement ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                Extraire la sélection
              </button>
              <button
                type="button"
                disabled={enCoursLancement || lancement?.statut === "EN_COURS"}
                onClick={() => void lancer(codesVisiblesDispo)}
                className="inline-flex h-10 items-center gap-2 rounded-[10px] border border-[#e2e8f0] bg-white px-4 text-[13.5px] font-semibold text-[#0f172a] disabled:opacity-50"
              >
                Extraire tout
              </button>
            </div>
          ) : null
        }
      />

      {/* Barre commune + filtres */}
      <div
        className="rounded-[12px] border border-[#e2e8f0] bg-white p-4"
        style={{ boxShadow: "0 1px 2px rgba(15,23,42,.04)" }}
      >
        <div className="flex flex-wrap items-end gap-4">
          <label className="flex flex-col gap-1 text-[12px] font-medium text-[#64748b]">
            Exercice
            <input
              readOnly
              value={exercice}
              className="h-[42px] w-[100px] rounded-[10px] border border-[#e2e8f0] bg-[#f8fafc] px-3 text-[14px] text-[#0f172a]"
            />
          </label>
          <label className="flex flex-col gap-1 text-[12px] font-medium text-[#64748b]">
            Date de situation
            <input
              type="date"
              value={dateSituation}
              onChange={(e) => setDateSituation(e.target.value)}
              className="h-[42px] rounded-[10px] border border-[#e2e8f0] px-3 text-[14px] text-[#0f172a]"
            />
          </label>
          <label className="flex flex-col gap-1 text-[12px] font-medium text-[#64748b]">
            Date début
            <input
              type="date"
              value={dateDebut}
              onChange={(e) =>
                appliquerDatesCommunes(e.target.value, dateFin || e.target.value)
              }
              className="h-[42px] rounded-[10px] border border-[#e2e8f0] px-3 text-[14px] text-[#0f172a]"
            />
          </label>
          <label className="flex flex-col gap-1 text-[12px] font-medium text-[#64748b]">
            Date fin
            <input
              type="date"
              value={dateFin}
              onChange={(e) =>
                appliquerDatesCommunes(
                  dateDebut || e.target.value,
                  e.target.value,
                )
              }
              className="h-[42px] rounded-[10px] border border-[#e2e8f0] px-3 text-[14px] text-[#0f172a]"
            />
          </label>
          <label className="flex flex-col gap-1 text-[12px] font-medium text-[#64748b]">
            Source
            <select
              value={filtreSource}
              onChange={(e) =>
                setFiltreSource(e.target.value as typeof filtreSource)
              }
              className="h-[42px] rounded-[10px] border border-[#e2e8f0] px-3 text-[14px]"
            >
              <option value="TOUTES">Toutes</option>
              <option value="IG">IG</option>
              <option value="DC">DC</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[12px] font-medium text-[#64748b]">
            Domaine
            <select
              value={filtreDomaine}
              onChange={(e) =>
                setFiltreDomaine(e.target.value as typeof filtreDomaine)
              }
              className="h-[42px] rounded-[10px] border border-[#e2e8f0] px-3 text-[14px]"
            >
              <option value="TOUS">Tous</option>
              <option value="RECETTES">Recettes</option>
              <option value="DEPENSES">Dépenses</option>
              <option value="EXECUTION">Exécution</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[12px] font-medium text-[#64748b]">
            Statut
            <select
              value={filtreStatut}
              onChange={(e) =>
                setFiltreStatut(e.target.value as typeof filtreStatut)
              }
              className="h-[42px] rounded-[10px] border border-[#e2e8f0] px-3 text-[14px]"
            >
              <option value="TOUS">Tous</option>
              <option value="a_extraire">À extraire</option>
              <option value="a_jour">À jour</option>
            </select>
          </label>
          <button
            type="button"
            onClick={() => void charger()}
            className="ml-auto inline-flex h-[42px] items-center gap-2 rounded-[10px] border border-[#e2e8f0] px-3 text-[13px] font-medium text-[#475569]"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Actualiser
          </button>
        </div>
      </div>

      {/* Pendant l'extraction : panneau de suivi à la place des onglets / tableau */}
      {extractionActive && lancement ? (
        <div className="overflow-hidden rounded-[14px] border border-[#b7dccb] bg-white shadow-[0_1px_3px_rgba(15,23,42,.06)]">
          <div
            className="flex flex-wrap items-start justify-between gap-4 border-b border-[#d8eee4] px-5 py-4"
            style={{ background: "linear-gradient(180deg, #f4faf7 0%, #fff 100%)" }}
          >
            <div className="min-w-0 flex-1">
              <div
                className="text-[18px] font-semibold tracking-[-0.01em] text-[#0f172a]"
                style={{
                  fontFamily: '"IBM Plex Serif", "IBM Plex Sans", serif',
                }}
              >
                Extraction{" "}
                {lancement.statut === "EN_COURS"
                  ? "en cours"
                  : lancement.statut === "ANNULE"
                    ? "annulée"
                    : "terminée"}
              </div>
              <div className="mt-1 text-[13.5px] text-[#475569]">
                Situation au {fmtIsoFr(lancement.date_situation)} · exercice{" "}
                {lancement.exercice}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-[#334155]">
                <span
                  className="font-mono text-[15px] font-semibold text-[#1e6650]"
                  style={{
                    fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
                  }}
                >
                  {lancement.pourcentage} %
                </span>
                <span>
                  {nbTermines} / {elementsTop.length} éléments
                </span>
                <span>{fmtDuree(lancement.temps_ecoule_s)}</span>
              </div>
              <div className="mt-3 h-2.5 max-w-[520px] overflow-hidden rounded-full bg-[#dceee5]">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${lancement.pourcentage}%`,
                    background: ACCENT,
                  }}
                />
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {lancement.statut === "EN_COURS" && estChef ? (
                <button
                  type="button"
                  onClick={() => void onAnnuler()}
                  className="inline-flex h-10 items-center gap-1.5 rounded-[10px] border border-[#fecaca] bg-white px-4 text-[13px] font-semibold text-rose-700"
                >
                  Annuler
                </button>
              ) : null}
              {lancement.statut !== "EN_COURS" ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    to="/sof/imports/historique-lots"
                    className="inline-flex h-10 items-center gap-1.5 rounded-[10px] border border-[#cce3d8] bg-white px-4 text-[13px] font-semibold text-[#1e6650]"
                  >
                    <History className="h-3.5 w-3.5" />
                    Voir les lots
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setLoaderOuvert(false);
                      void charger({
                        garderDate: true,
                        dateSituation: dateSituation || undefined,
                      });
                    }}
                    className="inline-flex h-10 items-center gap-1.5 rounded-[10px] px-4 text-[13px] font-semibold text-white"
                    style={{ background: ACCENT }}
                  >
                    Revenir aux presets
                  </button>
                </div>
              ) : null}
            </div>
          </div>

          <ul className="flex flex-col divide-y divide-[#eef2f0] px-2 py-1">
            {elementsTop.map((el) => (
              <ElementLigne key={el.id} el={el} />
            ))}
          </ul>

          {lancement.statut !== "EN_COURS" ? (
            <div className="flex flex-col gap-2 border-t border-[#d8eee4] bg-[#f4faf7] px-5 py-4 text-[13.5px] text-[#334155]">
              <div>
                <span className="font-semibold text-[#0f172a]">Résumé · </span>
                {nbOk} terminé{nbOk > 1 ? "s" : ""}
                {nbErreur > 0 ? `, ${nbErreur} en erreur` : ""}
                {nbIgnore > 0
                  ? `, ${nbIgnore} ignoré${nbIgnore > 1 ? "s" : ""}`
                  : ""}
                {" · "}
                {fmtDuree(lancement.temps_ecoule_s)}
              </div>
              <div className="text-[13px] leading-relaxed text-[#475569]">
                Chaque extraction réussie a créé un{" "}
                <span className="font-medium text-[#0f172a]">lot ACTIF</span>{" "}
                (lignes + montant). Consultez-les dans{" "}
                <Link
                  to="/sof/imports/historique-lots"
                  className="font-semibold text-[#1e6650] underline-offset-2 hover:underline"
                >
                  Imports › Historique des lots
                </Link>
                , ou rouvrez le tableau des presets (colonnes Dernier lot /
                Lignes / Total, statut « À jour »).
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <>
      {/* Onglets */}
      <div className="flex flex-wrap gap-1 border-b border-[#e2e8f0]">
        {famillesVisibles.map((f) => {
          const n = compteAExtraire(f.id);
          const actif = f.id === onglet;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => changerOnglet(f.id)}
              className={cn(
                "relative -mb-px px-3.5 py-2.5 text-[13.5px] font-medium transition-colors",
                actif
                  ? "border-b-2 text-[#0f172a]"
                  : "text-[#64748b] hover:text-[#0f172a]",
              )}
              style={actif ? { borderColor: ACCENT } : undefined}
            >
              {f.libelle}
              {n > 0 ? (
                <span
                  className="ml-2 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10.5px] font-bold text-white"
                  style={{ background: ACCENT }}
                >
                  {n}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {/* Tableau */}
      <div className="overflow-hidden rounded-[12px] border border-[#e2e8f0] bg-white">
        <div
          className="grid items-center gap-2 border-b border-[#e2e8f0] bg-[#f8fafc] px-3 py-2.5 text-[11.5px] font-semibold uppercase tracking-[0.04em] text-[#64748b]"
          style={{
            gridTemplateColumns:
              "36px minmax(220px, 1.4fr) 160px 140px 90px 120px 110px",
          }}
        >
          <span />
          <span>Extraction</span>
          <span>Période calculée</span>
          <span>Dernier lot</span>
          <span className="text-right">Lignes</span>
          <span className="text-right">Total</span>
          <span>Statut</span>
        </div>
        {chargement ? (
          <div className="flex items-center justify-center gap-2 py-16 text-[#64748b]">
            <Loader2 className="h-4 w-4 animate-spin" />
            Chargement…
          </div>
        ) : lignesOnglet.length === 0 ? (
          <div className="py-12 text-center text-[13.5px] text-[#64748b]">
            Aucun preset pour ces filtres.
          </div>
        ) : (
          lignesOnglet.map((p) => {
            const st = mapStatuts.get(p.code);
            const statut = st?.statut ?? "a_extraire";
            const couleurs = couleurStatut(statut);
            const actif = presetActif === p.code;
            const disabled = !p.disponible;
            return (
              <button
                key={p.code}
                type="button"
                onClick={() => selectionnerPreset(p.code)}
                className={cn(
                  "grid w-full items-center gap-2 border-b border-[#f1f5f9] px-3 py-2.5 text-left text-[13.5px] transition-colors last:border-b-0",
                  actif ? "bg-[#f0fdf6]" : "hover:bg-[#f8fafc]",
                  disabled && "opacity-60",
                )}
                style={{
                  gridTemplateColumns:
                    "36px minmax(220px, 1.4fr) 160px 140px 90px 120px 110px",
                }}
              >
                <span
                  className="flex items-center justify-center"
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                >
                  <input
                    type="checkbox"
                    disabled={disabled || !estChef}
                    checked={!!selection[p.code]}
                    onChange={(e) =>
                      setSelection((prev) => ({
                        ...prev,
                        [p.code]: e.target.checked,
                      }))
                    }
                    className="h-3.5 w-3.5 accent-[#1e6650]"
                  />
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-medium text-[#0f172a]">
                    {p.libelle}
                  </span>
                  <span className="block text-[11.5px] text-[#94a3b8]">
                    {p.source} · {p.ecran} · {p.format}
                  </span>
                </span>
                <span
                  className="font-mono text-[12px] text-[#475569]"
                  style={{
                    fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
                  }}
                >
                  {fmtPeriode(periodeEffective(p.code))}
                </span>
                <span className="text-[12.5px] text-[#475569]">
                  {st?.dernier_lot
                    ? fmtIsoFr(st.dernier_lot.importe_le.slice(0, 10))
                    : "—"}
                </span>
                <span
                  className="text-right font-mono text-[12.5px] text-[#0f172a]"
                  style={{
                    fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
                  }}
                >
                  {st?.dernier_lot
                    ? st.dernier_lot.nb_lignes.toLocaleString("fr-FR")
                    : "—"}
                </span>
                <span
                  className="text-right font-mono text-[12.5px] text-[#0f172a]"
                  style={{
                    fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
                  }}
                >
                  {st?.dernier_lot
                    ? formatMontant(st.dernier_lot.montant_total)
                    : "—"}
                </span>
                <span>
                  <span
                    className="inline-flex h-[22px] items-center rounded-full px-2 text-[11px] font-semibold"
                    style={{
                      background: couleurs.bg,
                      color: couleurs.color,
                    }}
                  >
                    {libelleStatutLigne(statut)}
                  </span>
                </span>
              </button>
            );
          })
        )}
      </div>

      {/* Détail preset — dialog au clic sur une ligne */}
      <Dialog
        open={Boolean(presetSelectionne)}
        onOpenChange={(ouvert) => {
          if (!ouvert) fermerPreset();
        }}
      >
        <DialogContent
          showCloseButton
          className="gap-0 overflow-hidden p-0 sm:max-w-[560px]"
        >
          {presetSelectionne ? (
            <>
              <DialogHeader className="gap-1.5 border-b border-[#e2e8f0] px-6 py-5 text-left">
                <DialogTitle
                  className="text-[17px] font-semibold leading-snug text-[#0f172a]"
                  style={{
                    fontFamily: '"IBM Plex Serif", "IBM Plex Sans", serif',
                  }}
                >
                  {presetSelectionne.libelle}
                </DialogTitle>
                <DialogDescription className="flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-[#64748b]">
                  <span>Domaine : {presetSelectionne.domaine_libelle}</span>
                  <span>Écran : {presetSelectionne.ecran}</span>
                  <span>Format : {presetSelectionne.format}</span>
                  {presetSelectionne.ref_manuel ? (
                    <span>Réf. : {presetSelectionne.ref_manuel}</span>
                  ) : null}
                </DialogDescription>
              </DialogHeader>

              <div className="flex flex-col gap-3 px-6 py-5">
                {statutSelectionne?.dernier_lot ? (
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-[#cce3d8] bg-[#f4faf7] px-3 py-2.5 text-[13px]">
                    <div className="text-[#334155]">
                      <span className="font-semibold text-[#0f172a]">
                        Dernier lot #{statutSelectionne.dernier_lot.id}
                      </span>
                      {" · "}
                      {statutSelectionne.dernier_lot.nb_lignes.toLocaleString(
                        "fr-FR",
                      )}{" "}
                      lignes ·{" "}
                      {formatMontant(
                        statutSelectionne.dernier_lot.montant_total,
                      )}{" "}
                      ·{" "}
                      {fmtIsoFr(
                        statutSelectionne.dernier_lot.importe_le.slice(0, 10),
                      )}
                    </div>
                    <Link
                      to="/sof/imports/historique-lots"
                      className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-[#1e6650]"
                    >
                      Historique
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                ) : null}

                {!presetSelectionne.disponible ? (
                  <div className="rounded-[10px] border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2.5 text-[13px] text-[#64748b]">
                    {presetSelectionne.motif_indisponible ||
                      "Extraction non disponible."}
                    {presetSelectionne.depot_excel_uniquement
                      ? " Utilisez le dépôt Excel depuis l’historique ou la page dédiée."
                      : null}
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-wrap items-end gap-3">
                      <label className="flex flex-col gap-1 text-[12px] font-medium text-[#64748b]">
                        Date début
                        <input
                          type="date"
                          value={
                            surcharges[presetSelectionne.code]?.date_debut ?? ""
                          }
                          onChange={(e) =>
                            majDatesPreset(
                              presetSelectionne.code,
                              "date_debut",
                              e.target.value,
                            )
                          }
                          className="h-[42px] rounded-[10px] border border-[#e2e8f0] px-3 text-[14px] text-[#0f172a]"
                        />
                      </label>
                      <label className="flex flex-col gap-1 text-[12px] font-medium text-[#64748b]">
                        Date fin
                        <input
                          type="date"
                          value={
                            surcharges[presetSelectionne.code]?.date_fin ?? ""
                          }
                          onChange={(e) =>
                            majDatesPreset(
                              presetSelectionne.code,
                              "date_fin",
                              e.target.value,
                            )
                          }
                          className="h-[42px] rounded-[10px] border border-[#e2e8f0] px-3 text-[14px] text-[#0f172a]"
                        />
                      </label>
                    </div>
                    <div className="text-[12.5px] text-[#94a3b8]">
                      Prérempli depuis la date de situation (
                      {presetSelectionne.periode_par_defaut
                        .replaceAll("_", " ")
                        .toLowerCase()}
                      )
                      {statutSelectionne
                        ? ` · défaut ${fmtPeriode(statutSelectionne.periode_calculee)}`
                        : ""}
                      . Modifiable avant lancement.
                    </div>
                  </div>
                )}
              </div>

              <DialogFooter className="gap-2 border-t border-[#e2e8f0] bg-[#f8fafc] px-6 py-3.5 sm:justify-end">
                <button
                  type="button"
                  onClick={fermerPreset}
                  className="inline-flex h-9 items-center rounded-[10px] border border-[#cbd5e1] bg-white px-3.5 text-[13px] font-semibold text-[#0f172a]"
                >
                  Fermer
                </button>
                {presetSelectionne.disponible && estChef ? (
                  <button
                    type="button"
                    disabled={
                      enCoursLancement || lancement?.statut === "EN_COURS"
                    }
                    onClick={() => {
                      void lancer([presetSelectionne.code]).then((ok) => {
                        if (ok) fermerPreset();
                      });
                    }}
                    className="inline-flex h-9 items-center gap-1.5 rounded-[10px] px-3.5 text-[13px] font-semibold text-white disabled:opacity-50"
                    style={{ background: ACCENT }}
                  >
                    {enCoursLancement ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Play className="h-3.5 w-3.5" />
                    )}
                    Extraire
                  </button>
                ) : null}
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
        </>
      )}
    </div>
  );
}

function ElementLigne({ el }: { el: ElementLancement }) {
  const detail =
    el.statut === "EN_COURS"
      ? el.lignes_traitees != null && el.lignes_a_extraire != null
        ? `${el.lignes_traitees.toLocaleString("fr-FR")} / ${el.lignes_a_extraire.toLocaleString("fr-FR")}`
        : el.message
      : el.statut === "TERMINE"
        ? el.message ||
          (el.lignes_traitees != null
            ? `${el.lignes_traitees.toLocaleString("fr-FR")} lignes`
            : null)
        : el.message;

  return (
    <li
      className={cn(
        "flex items-start gap-3 px-3 py-3 text-[13.5px]",
        el.statut === "EN_COURS" && "bg-[#f0fdf6]",
        el.statut === "ERREUR" && "bg-[#fff5f5]",
      )}
    >
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center">
        <SymboleStatut statut={el.statut} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <span
            className={cn(
              "font-medium text-[#0f172a]",
              (el.statut === "EN_ATTENTE" ||
                el.statut === "IGNORE" ||
                el.statut === "ANNULE") &&
                "text-[#64748b]",
            )}
          >
            {el.titre}
          </span>
          <span className="flex shrink-0 flex-wrap items-center gap-2 text-[12.5px] text-[#64748b]">
            {detail}
            {el.statut === "EN_COURS" && el.pourcentage > 0 ? (
              <span className="font-semibold text-[#1e6650]">
                {el.pourcentage} %
              </span>
            ) : null}
            {el.statut === "TERMINE" && el.lot_id ? (
              <span className="rounded-full bg-[#ecfdf5] px-2 py-0.5 text-[11px] font-semibold text-[#047857]">
                Lot #{el.lot_id}
              </span>
            ) : null}
          </span>
        </div>
        {el.statut === "EN_COURS" ? (
          <div className="mt-2 h-1.5 max-w-[360px] overflow-hidden rounded-full bg-[#dceee5]">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${Math.max(el.pourcentage, 4)}%`,
                background: ACCENT,
              }}
            />
          </div>
        ) : null}
      </div>
    </li>
  );
}
