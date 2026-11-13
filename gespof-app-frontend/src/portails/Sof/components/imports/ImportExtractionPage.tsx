import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  ChevronRight,
  Database,
  Loader2,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { SofPageHeader } from "@/portails/Sof/components/layout/SofPageHeader";
import {
  CardShell,
  ChipCol,
  Kpi,
  MONO,
  SOF_VERT,
  dateFr,
  moisPeriodeLibelle,
} from "@/portails/Sof/components/SofCards";
import { listerPeriodes } from "@/portails/Sof/api/referentiel";
import type {
  AnomalieImportSof,
  ClientImportExtraction,
  EtatImportExtraction,
  ResultatImportExtraction,
} from "@/portails/Sof/api/import-extraction";
import type { PeriodeSof } from "@/portails/Sof/types/referentiel.interface";
import { useAuth } from "@/shared/hooks/use-auth";
import { formatMontant } from "@/shared/lib/format";

const PAGE_SIZE = 20;

type ModeImport = "ora" | "xls";
type StatutLot = "manquant" | "chargé" | "reçu";

export interface ConfigImportExtraction<TLigne extends { id: number }> {
  titre: string;
  description: string;
  /** Pastille « Remplace » de la maquette. */
  remplace: string;
  /** Libellé de la requête Oracle enregistrée (XRAM, VIDR…). */
  requeteOracle: string;
  /** Champs fixes affichés dans « Paramètres d'extraction ». */
  filtres: Array<[label: string, valeur: string]>;
  /** Colonnes d'aperçu / de contrôle. */
  colonnes: readonly string[];
  /** Colonnes attendues côté import, si différentes de l'aperçu. */
  colonnesControle?: readonly string[];
  /** Phrases de la carte « Contrôles appliqués ». */
  controles: string[];
  /** Libellé KPI montant. */
  libelleMontant: string;
  /** Message affiché si aucune ligne n'est importée. */
  messageVide: string;
  /** Libellés optionnels des champs date. */
  labelDateDebut?: string;
  labelDateFin?: string;
  client: ClientImportExtraction<TLigne>;
  cellule: (col: string, ligne: TLigne) => string;
  estMontant: (col: string) => boolean;
  estMono: (col: string) => boolean;
  /** Largeur minimale du tableau d'aperçu. */
  largeurMin?: number;
}

function isoPremierJanvier(annee: number): string {
  return `${annee}-01-01`;
}

function isoFinDuMois(annee: number, mois: number): string {
  const fin = new Date(annee, mois, 0);
  return `${fin.getFullYear()}-${String(fin.getMonth() + 1).padStart(2, "0")}-${String(fin.getDate()).padStart(2, "0")}`;
}

/**
 * Page d'import « extraction » SOF (Oracle ou Excel) — vues exclusives
 * extraction XOR résultats, aperçu paginé, anomalies. Adaptée de
 * `ReglementsTvaDc` pour RAP TVA (DC) et Règlements TVA (IG).
 */
export function ImportExtractionPage<TLigne extends { id: number }>({
  config,
}: {
  config: ConfigImportExtraction<TLigne>;
}) {
  const { hasAnyRole } = useAuth();
  const estChef = hasAnyRole(["CHEF_SOF"]);
  const fileRef = useRef<HTMLInputElement>(null);
  const { client, colonnes } = config;
  const colonnesControle = config.colonnesControle ?? colonnes;

  const [periodes, setPeriodes] = useState<PeriodeSof[]>([]);
  const [periodeId, setPeriodeId] = useState<number | "">("");
  const [exercice, setExercice] = useState("2026");
  const [dateDebut, setDateDebut] = useState("");
  const [dateFin, setDateFin] = useState("");

  const [mode, setMode] = useState<ModeImport>("ora");
  const [statut, setStatut] = useState<StatutLot>("manquant");
  /** Vues exclusives : extraction XOR résultats. */
  const [vue, setVue] = useState<"extraction" | "resultats">("extraction");

  const [etat, setEtat] = useState<EtatImportExtraction<TLigne> | null>(null);
  const [page, setPage] = useState(1);
  const [chargement, setChargement] = useState(true);
  const [importEnCours, setImportEnCours] = useState(false);

  const exercices = useMemo(() => {
    const ans = [...new Set(periodes.map((p) => p.exercice_annee))].sort(
      (a, b) => b - a,
    );
    return ans.length ? ans.map(String) : ["2026"];
  }, [periodes]);

  const periodeCourante = useMemo(
    () => periodes.find((p) => p.id === periodeId),
    [periodes, periodeId],
  );

  const aDesResultats = (etat?.nombre ?? 0) > 0;
  const afficherResultats = vue === "resultats" && aDesResultats;

  useEffect(() => {
    listerPeriodes()
      .then((res) => {
        const liste = [...(res.periodes ?? [])].sort(
          (a, b) => b.exercice_annee - a.exercice_annee || b.mois - a.mois,
        );
        setPeriodes(liste);
        if (liste[0]) {
          setPeriodeId(liste[0].id);
          setExercice(String(liste[0].exercice_annee));
          setDateDebut(isoPremierJanvier(liste[0].exercice_annee));
          setDateFin(isoFinDuMois(liste[0].exercice_annee, liste[0].mois));
        }
      })
      .catch((e) =>
        toast.error(e instanceof Error ? e.message : "Périodes indisponibles."),
      );
  }, []);

  async function recharger(
    pid: number,
    pageCible = 1,
    options?: { garderCharge?: boolean; ouvrirResultatsSiDonnees?: boolean },
  ) {
    setChargement(true);
    try {
      const res = await client.obtenirEtat({
        periode_id: pid,
        page: pageCible,
        page_size: PAGE_SIZE,
      });
      setEtat(res);
      setPage(res.page || pageCible);
      const aDonnees = (res.nombre ?? 0) > 0;
      if (options?.garderCharge && aDonnees) {
        setStatut("chargé");
        setVue("resultats");
      } else if (options?.ouvrirResultatsSiDonnees) {
        if (aDonnees) {
          setStatut((prev) => (prev === "chargé" ? "chargé" : "reçu"));
          setVue("resultats");
        } else {
          setStatut("manquant");
          setVue("extraction");
        }
      } else if (aDonnees) {
        setStatut((prev) => (prev === "chargé" ? "chargé" : "reçu"));
      } else if (!options?.garderCharge) {
        setStatut("manquant");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Chargement impossible.");
      setEtat((prev) =>
        prev ??
          ({
            periode: null,
            compte: config.filtres[0]?.[1] ?? "",
            nature: config.filtres[1]?.[1] ?? "",
            lot: null,
            lignes: [],
            anomalies: [],
            nombre: 0,
            total: "0",
            premiere_date: null,
            derniere_date: null,
            page: 1,
            page_size: PAGE_SIZE,
            pages: 0,
            message: null,
            colonnes: [...colonnes],
          } as EtatImportExtraction<TLigne>),
      );
      setVue("extraction");
      setStatut("manquant");
    } finally {
      setChargement(false);
    }
  }

  function appliquerEtatImport(res: ResultatImportExtraction<TLigne>) {
    setEtat(res);
    setPage(res.page || 1);
    const aDonnees = (res.nombre ?? 0) > 0;
    if (aDonnees) {
      setStatut("chargé");
      setVue("resultats");
    } else {
      setStatut("manquant");
      setVue("extraction");
      toast.message(config.messageVide);
    }
  }

  useEffect(() => {
    if (periodeId === "") return;
    void recharger(periodeId, 1, { ouvrirResultatsSiDonnees: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodeId]);

  const chipSt: "ok" | "neu" = etat?.lot ? "ok" : "neu";

  const anomalies: AnomalieImportSof[] = etat?.anomalies ?? [];
  const lignes = etat?.lignes ?? [];
  const pages = etat?.pages ?? 0;

  function appliquerPeriode(p: PeriodeSof) {
    setPeriodeId(p.id);
    setExercice(String(p.exercice_annee));
    setDateDebut(isoPremierJanvier(p.exercice_annee));
    setDateFin(isoFinDuMois(p.exercice_annee, p.mois));
    setStatut("manquant");
    setEtat(null);
    setPage(1);
  }

  function toastCharge(res: { nombre?: number }) {
    if ((res.nombre ?? 0) > 0) {
      toast.success(
        `Fichier chargé : ${(res.nombre ?? 0).toLocaleString("fr-FR")} ligne(s) · vérifiez l'aperçu puis validez l'import.`,
      );
    }
  }

  async function extraireOracle() {
    if (!estChef || periodeId === "") return;
    setImportEnCours(true);
    try {
      const res = await client.importerOracle({
        date_debut: dateDebut,
        date_fin: dateFin,
        periode_id: periodeId,
      });
      appliquerEtatImport(res);
      toastCharge(res);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import impossible.");
    } finally {
      setImportEnCours(false);
    }
  }

  async function chargerExcel(file: File) {
    if (!estChef || periodeId === "") return;
    setImportEnCours(true);
    try {
      const res = await client.importerExcel({
        fichier: file,
        periode_id: periodeId,
        date_debut: dateDebut,
        date_fin: dateFin,
      });
      appliquerEtatImport(res);
      toastCharge(res);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import Excel impossible.");
    } finally {
      setImportEnCours(false);
    }
  }

  function validerImport() {
    setStatut("reçu");
    setVue("resultats");
    toast.success("Import validé : le lot précédent est remplacé.");
  }

  function annulerCharge() {
    setStatut("manquant");
    setVue("extraction");
    toast.message("Import annulé.");
  }

  async function allerPage(p: number) {
    if (periodeId === "" || p < 1 || (pages > 0 && p > pages)) return;
    await recharger(periodeId, p, { garderCharge: statut === "chargé" });
  }

  const champRo =
    "flex min-h-[38px] items-center rounded-md border border-[#e2e8f0] bg-[#f8fafc] px-2.5 text-[14px] text-[#0f172a]";
  const champIn =
    "h-[38px] rounded-md border border-[#cbd5e1] bg-white px-2.5 text-[14px] text-[#0f172a] outline-none";

  const vs = etat?.vs_precedent ?? null;
  const vsValeur =
    vs == null
      ? "—"
      : `${vs.pct > 0 ? "+" : vs.pct < 0 ? "−" : ""}${Math.abs(vs.pct).toFixed(1).replace(".", ",")} %`;

  const actionsHeader =
    vue === "resultats" && statut === "chargé" ? (
      <>
        <button
          type="button"
          disabled={!estChef}
          onClick={annulerCharge}
          className="inline-flex h-[38px] items-center gap-2 rounded-md border border-[#cbd5e1] bg-white px-3.5 text-[13.5px] font-semibold text-[#0f172a] disabled:opacity-50"
        >
          <X size={16} />
          Annuler
        </button>
        <button
          type="button"
          disabled={!estChef}
          onClick={validerImport}
          className="inline-flex h-[38px] items-center gap-2 rounded-md px-3.5 text-[13.5px] font-semibold text-white disabled:opacity-50"
          style={{ background: SOF_VERT, border: `1px solid ${SOF_VERT}` }}
        >
          <Check size={16} strokeWidth={2.4} />
          Valider l&apos;import
        </button>
      </>
    ) : vue === "resultats" ? (
      <button
        type="button"
        onClick={() => setVue("extraction")}
        className="inline-flex h-[38px] items-center gap-2 rounded-md border border-[#cbd5e1] bg-white px-3.5 text-[13.5px] font-semibold text-[#0f172a]"
      >
        Nouvelle extraction
      </button>
    ) : null;

  const pagination = (
    <div className="flex items-center gap-2.5 text-[13px] text-[#475569]">
      <button
        type="button"
        disabled={page <= 1 || chargement}
        onClick={() => void allerPage(page - 1)}
        className="grid size-8 place-items-center rounded-md border border-[#cbd5e1] bg-white disabled:opacity-40"
        aria-label="Page précédente"
      >
        <ChevronRight size={16} className="rotate-180" />
      </button>
      <span className="min-w-[110px] text-center">
        Page {page} / {pages}
      </span>
      <button
        type="button"
        disabled={page >= pages || chargement}
        onClick={() => void allerPage(page + 1)}
        className="grid size-8 place-items-center rounded-md border border-[#cbd5e1] bg-white disabled:opacity-40"
        aria-label="Page suivante"
      >
        <ChevronRight size={16} />
      </button>
    </div>
  );

  const enVerification = etat === null;

  return (
    <div className="flex flex-col gap-[18px]">
      <SofPageHeader
        title={config.titre}
        description={config.description}
        remplace={config.remplace}
        actions={enVerification ? null : actionsHeader}
      />

      {enVerification ? (
        <div className="flex min-h-[220px] items-center justify-center gap-2 text-[13.5px] text-[#64748b]">
          <Loader2 size={18} className="animate-spin" />
          Vérification des données…
        </div>
      ) : !afficherResultats ? (
        <div className="flex flex-wrap items-stretch gap-[18px]">
          <div
            className="flex min-w-0 flex-1 flex-col gap-[18px]"
            style={{ flex: "1 1 420px" }}
          >
            <CardShell
              title="Paramètres d'extraction"
              sub="Pré-remplis à partir de la période"
            >
              <div
                className="grid gap-x-4 gap-y-3.5"
                style={{
                  padding: 16,
                  gridTemplateColumns:
                    "repeat(auto-fill, minmax(min(100%, 180px), 1fr))",
                }}
              >
                <label className="flex flex-col gap-1.5">
                  <span className="text-[12.5px] font-semibold text-[#334155]">
                    Exercice
                  </span>
                  <select
                    value={exercice}
                    onChange={(e) => {
                      const an = e.target.value;
                      setExercice(an);
                      const p = periodes.find(
                        (x) => String(x.exercice_annee) === an,
                      );
                      if (p) appliquerPeriode(p);
                    }}
                    className={champIn}
                  >
                    {exercices.map((a) => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[12.5px] font-semibold text-[#334155]">
                    {config.labelDateDebut ?? "Période du"}
                  </span>
                  <input
                    type="date"
                    value={dateDebut}
                    onChange={(e) => setDateDebut(e.target.value)}
                    className={champIn}
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[12.5px] font-semibold text-[#334155]">
                    {config.labelDateFin ?? "Au"}
                  </span>
                  <input
                    type="date"
                    value={dateFin}
                    onChange={(e) => setDateFin(e.target.value)}
                    className={champIn}
                  />
                </label>
                {config.filtres.map(([label, valeur]) => (
                  <label key={label} className="flex flex-col gap-1.5">
                    <span className="text-[12.5px] font-semibold text-[#334155]">
                      {label}
                    </span>
                    <span className={champRo}>{valeur}</span>
                  </label>
                ))}
              </div>
            </CardShell>

            <CardShell
              title="Contrôles appliqués"
              tone={{ bg: "#f0f7f4", bd: "#bfdccf" }}
            >
              <div
                className="flex flex-col gap-2"
                style={{ padding: "14px 16px" }}
              >
                {config.controles.map((c) => (
                  <div
                    key={c}
                    className="flex gap-2.5 text-[13.5px] leading-[1.55]"
                    style={{ color: "#1e6650" }}
                  >
                    <span
                      className="mt-[9px] size-[5px] flex-none rounded-full"
                      style={{ background: SOF_VERT }}
                    />
                    <span>{c}</span>
                  </div>
                ))}
              </div>
            </CardShell>
          </div>

          <div
            className="flex min-w-0 flex-1 flex-col gap-[18px]"
            style={{ flex: "1 1 420px" }}
          >
            <CardShell
              title="Mode d'import"
              sub="Requête Oracle disponible"
              headRight={
                <div className="flex rounded-md border border-[#cbd5e1] bg-[#f8fafc] p-0.5">
                  {(
                    [
                      ["ora", "Extraire depuis Oracle"],
                      ["xls", "Déposer un fichier Excel"],
                    ] as const
                  ).map(([k, l]) => {
                    const on = mode === k;
                    return (
                      <button
                        key={k}
                        type="button"
                        onClick={() => setMode(k)}
                        className="h-7 rounded px-2.5 text-[12.5px] font-semibold"
                        style={{
                          background: on ? "#fff" : "transparent",
                          color: on ? "#1e6650" : "#475569",
                          boxShadow: on
                            ? "0 1px 2px rgba(15,23,42,.15)"
                            : "none",
                        }}
                      >
                        {l}
                      </button>
                    );
                  })}
                </div>
              }
            >
              <div className="flex flex-col gap-3.5" style={{ padding: 16 }}>
                {mode === "ora" ? (
                  <div
                    className="flex flex-col gap-3 rounded-lg border border-[#bfdccf]"
                    style={{ padding: 16, background: "#f0f7f4" }}
                  >
                    <span className="text-[13.5px] text-[#334155]">
                      Requête enregistrée :{" "}
                      <span style={{ fontFamily: MONO, color: "#1e6650" }}>
                        {config.requeteOracle}
                      </span>
                    </span>
                    <button
                      type="button"
                      disabled={!estChef || importEnCours || periodeId === ""}
                      onClick={() => void extraireOracle()}
                      title={estChef ? undefined : "Réservé au Chef SOF"}
                      className="inline-flex h-[38px] w-fit items-center gap-2 rounded-md px-3.5 text-[13.5px] font-semibold text-white disabled:opacity-50"
                      style={{ background: SOF_VERT }}
                    >
                      {importEnCours ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <Database size={16} />
                      )}
                      Extraire depuis Oracle
                    </button>
                  </div>
                ) : (
                  <div
                    className="grid gap-2.5"
                    style={{
                      gridTemplateColumns:
                        "repeat(auto-fit, minmax(200px, 1fr))",
                    }}
                  >
                    <button
                      type="button"
                      disabled={!estChef || importEnCours}
                      onClick={() => fileRef.current?.click()}
                      className="flex flex-col items-center gap-1.5 rounded-lg border-[1.5px] border-dashed border-[#bfdccf] bg-[#f7fbf9] text-center hover:border-[#2a7f62] disabled:opacity-50"
                      style={{ padding: "20px 12px" }}
                    >
                      {importEnCours ? (
                        <Loader2
                          size={18}
                          className="animate-spin text-[#1e6650]"
                        />
                      ) : (
                        <Upload size={18} className="text-[#1e6650]" />
                      )}
                      <span className="text-[13.5px] font-semibold text-[#0f172a]">
                        Fichier Excel
                      </span>
                      <span className="text-[12px] text-[#64748b]">
                        Déposez le fichier Excel ou cliquez pour parcourir
                      </span>
                    </button>
                    <input
                      ref={fileRef}
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        e.target.value = "";
                        if (f) void chargerExcel(f);
                      }}
                    />
                  </div>
                )}
              </div>
            </CardShell>

            <CardShell
              title="Contrôle des colonnes"
              stretch
              sub={
                chipSt === "ok"
                  ? `${colonnesControle.length} en-têtes attendus`
                  : "En attente d'un fichier"
              }
            >
              <div
                className="flex flex-wrap content-start gap-1.5"
                style={{ padding: "14px 16px" }}
              >
                {colonnesControle.map((c) => (
                  <ChipCol key={c} label={c} st={chipSt} />
                ))}
              </div>
            </CardShell>
          </div>
        </div>
      ) : (
        <>
          {chargement ? (
            <div className="flex items-center gap-2 text-[13.5px] text-[#64748b]">
              <Loader2 size={16} className="animate-spin" />
              Chargement…
            </div>
          ) : null}

          <div
            className="grid gap-3"
            style={{
              gridTemplateColumns:
                "repeat(auto-fit, minmax(min(100%, 170px), 1fr))",
            }}
          >
            <Kpi
              label="Lignes"
              valeur={(etat?.nombre ?? 0).toLocaleString("fr-FR")}
              sous={statut === "chargé" ? "Lot en attente" : "Lot actif"}
            />
            <Kpi
              label={config.libelleMontant}
              valeur={formatMontant(etat?.total ?? "0")}
              unite="FCFA"
              sous="Somme des montants"
            />
            <Kpi
              label="Première date"
              valeur={dateFr(etat?.premiere_date)}
              sous="Date comptable"
            />
            <Kpi
              label="Dernière date"
              valeur={dateFr(etat?.derniere_date)}
              sous="Date comptable"
            />
            <Kpi
              label="Vs import précédent"
              valeur={vsValeur}
              sous={
                vs?.alerte
                  ? "Chute forte du nombre de lignes"
                  : (vs?.libelle ?? "—")
              }
              accent={vs?.alerte ? "#b45309" : SOF_VERT}
              fg={vs?.alerte ? "#b91c1c" : "#0f172a"}
            />
          </div>

          <CardShell
            title="Aperçu des lignes"
            sub={`Lot chargé pour ${moisPeriodeLibelle(periodeCourante)} · ${PAGE_SIZE} par page`}
            headRight={pages > 1 ? pagination : null}
          >
            <div className="overflow-x-auto">
              <table
                className="w-full border-collapse text-[13px]"
                style={{ minWidth: config.largeurMin ?? 960 }}
              >
                <thead>
                  <tr className="border-b border-[#e2e8f0] bg-[#f8fafc]">
                    {colonnes.map((c) => (
                      <th
                        key={c}
                        className="px-2.5 py-2 text-[11.5px] font-semibold tracking-[0.04em] whitespace-nowrap text-[#64748b] uppercase"
                        style={{
                          textAlign: config.estMontant(c) ? "right" : "left",
                          fontFamily: MONO,
                        }}
                      >
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lignes.length === 0 ? (
                    <tr>
                      <td
                        colSpan={colonnes.length}
                        className="px-4 py-6 text-center text-[13.5px] text-[#64748b]"
                      >
                        {etat?.message ?? "Aucune ligne."}
                      </td>
                    </tr>
                  ) : (
                    lignes.map((l) => (
                      <tr
                        key={l.id}
                        className="border-b border-[#f1f5f9] hover:bg-[#f8fafc]"
                      >
                        {colonnes.map((c) => (
                          <td
                            key={c}
                            className="px-2.5 py-2 text-[#0f172a]"
                            style={{
                              textAlign: config.estMontant(c)
                                ? "right"
                                : "left",
                              fontFamily: config.estMono(c) ? MONO : undefined,
                              fontVariantNumeric: config.estMontant(c)
                                ? "tabular-nums"
                                : undefined,
                            }}
                          >
                            {config.cellule(c, l)}
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {pages > 1 ? (
              <div
                className="flex items-center justify-center border-t border-[#e2e8f0]"
                style={{ padding: "12px 16px" }}
              >
                {pagination}
              </div>
            ) : null}
          </CardShell>

          <CardShell
            title="Anomalies"
            sub={
              anomalies.length
                ? `${anomalies.length} anomalie${anomalies.length > 1 ? "s" : ""} · ligne, colonne, motif`
                : "Aucune anomalie détectée"
            }
          >
            {anomalies.length === 0 ? (
              <div className="px-4 py-6 text-center text-[13.5px] text-[#64748b]">
                Aucune anomalie : toutes les lignes respectent les contrôles.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-[13px]">
                  <thead>
                    <tr className="border-b border-[#e2e8f0] bg-[#f8fafc]">
                      <th className="w-[90px] px-2.5 py-2 text-right text-[11.5px] font-semibold text-[#64748b] uppercase">
                        Ligne
                      </th>
                      <th className="w-[180px] px-2.5 py-2 text-left text-[11.5px] font-semibold text-[#64748b] uppercase">
                        Colonne
                      </th>
                      <th className="px-2.5 py-2 text-left text-[11.5px] font-semibold text-[#64748b] uppercase">
                        Motif
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {anomalies.map((a, i) => (
                      <tr
                        key={`${a.ligne}-${a.colonne}-${i}`}
                        className="border-b border-[#f1f5f9]"
                      >
                        <td
                          className="px-2.5 py-2 text-right"
                          style={{ fontFamily: MONO }}
                        >
                          {a.ligne}
                        </td>
                        <td
                          className="px-2.5 py-2"
                          style={{ fontFamily: MONO }}
                        >
                          {a.colonne ?? "—"}
                        </td>
                        <td className="px-2.5 py-2" style={{ color: "#b91c1c" }}>
                          {a.motif}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardShell>
        </>
      )}
    </div>
  );
}
