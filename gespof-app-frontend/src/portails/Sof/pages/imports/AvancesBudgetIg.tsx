import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronRight, Database, Loader2, Upload } from "lucide-react";
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
import {
  COLS_VIDR,
  celluleVidr,
  estMontantVidr,
  estMonoVidr,
} from "@/portails/Sof/components/imports/ig-vidr";
import { listerPeriodes } from "@/portails/Sof/api/referentiel";
import {
  importerExcelIgAvancesBudget,
  importerOracleIgAvancesBudget,
  obtenirEtatIgAvancesBudget,
  type CompteAvanceBudget,
  type EtatIgAvancesBudget,
  type ResumeCompteAvanceBudget,
} from "@/portails/Sof/api/ig-avances-budget";
import type { AnomalieImportSof } from "@/portails/Sof/api/import-extraction";
import type { PeriodeSof } from "@/portails/Sof/types/referentiel.interface";
import { useAuth } from "@/shared/hooks/use-auth";
import { formatMontant } from "@/shared/lib/format";

const PAGE_SIZE = 20;
const COMPTE_ETAT: CompteAvanceBudget = "4701-5";
const COMPTE_POSTE: CompteAvanceBudget = "4706-1";

function isoPremierJanvier(annee: number): string {
  return `${annee}-01-01`;
}

function isoFinDuMois(annee: number, mois: number): string {
  const fin = new Date(annee, mois, 0);
  return `${fin.getFullYear()}-${String(fin.getMonth() + 1).padStart(2, "0")}-${String(fin.getDate()).padStart(2, "0")}`;
}

export default function AvancesBudgetIg() {
  const { hasAnyRole } = useAuth();
  const estChef = hasAnyRole(["CHEF_SOF"]);
  const refsFichiers = {
    [COMPTE_ETAT]: useRef<HTMLInputElement>(null),
    [COMPTE_POSTE]: useRef<HTMLInputElement>(null),
  };

  const [periodes, setPeriodes] = useState<PeriodeSof[]>([]);
  const [periodeId, setPeriodeId] = useState<number | "">("");
  const [exercice, setExercice] = useState("2026");
  const [dateDebut, setDateDebut] = useState("");
  const [dateFin, setDateFin] = useState("");
  const [compteActif, setCompteActif] = useState<CompteAvanceBudget>(COMPTE_ETAT);
  const [vue, setVue] = useState<"extraction" | "resultats">("extraction");
  const [etat, setEtat] = useState<EtatIgAvancesBudget | null>(null);
  const [page, setPage] = useState(1);
  const [chargement, setChargement] = useState(true);
  const [importEnCours, setImportEnCours] = useState<CompteAvanceBudget | null>(
    null,
  );

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

  const resumes = etat?.comptes ?? [];
  const resumeActif =
    resumes.find((c) => c.compte === compteActif) ?? resumeVide(compteActif);
  const aDesLots = resumes.some((c) => c.lot != null || c.nombre > 0);
  const afficherResultats = vue === "resultats" && aDesLots;
  const anomalies: AnomalieImportSof[] = etat?.anomalies ?? [];
  const lignes = etat?.lignes ?? [];
  const pages = etat?.pages ?? 0;

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
    compte = compteActif,
    pageCible = 1,
    options?: { conserverVue?: boolean },
  ) {
    setChargement(true);
    try {
      const res = await obtenirEtatIgAvancesBudget({
        periode_id: pid,
        compte,
        page: pageCible,
        page_size: PAGE_SIZE,
      });
      setEtat(res);
      setPage(res.page || pageCible);
      const aDonnees = (res.comptes ?? []).some((c) => c.lot != null || c.nombre > 0);
      if (!options?.conserverVue) {
        setVue(aDonnees ? "resultats" : "extraction");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Chargement impossible.");
      setEtat(null);
      if (!options?.conserverVue) setVue("extraction");
    } finally {
      setChargement(false);
    }
  }

  useEffect(() => {
    if (periodeId === "") return;
    void recharger(periodeId, compteActif, 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodeId, compteActif]);

  function appliquerPeriode(p: PeriodeSof) {
    setPeriodeId(p.id);
    setExercice(String(p.exercice_annee));
    setDateDebut(isoPremierJanvier(p.exercice_annee));
    setDateFin(isoFinDuMois(p.exercice_annee, p.mois));
    setEtat(null);
    setPage(1);
  }

  async function importerOracle(compte: CompteAvanceBudget) {
    if (!estChef || periodeId === "") return;
    setImportEnCours(compte);
    try {
      const res = await importerOracleIgAvancesBudget({
        compte,
        date_debut: dateDebut,
        date_fin: dateFin,
        periode_id: periodeId,
      });
      setCompteActif(compte);
      setEtat(res);
      setPage(res.page || 1);
      setVue("resultats");
      const resume =
        res.comptes.find((c) => c.compte === compte) ?? resumeVide(compte);
      toast.success(
        `${resume.label} importé : ${resume.nombre.toLocaleString("fr-FR")} ligne(s).`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import Oracle impossible.");
    } finally {
      setImportEnCours(null);
    }
  }

  async function importerExcel(compte: CompteAvanceBudget, fichier: File) {
    if (!estChef || periodeId === "") return;
    setImportEnCours(compte);
    try {
      const res = await importerExcelIgAvancesBudget({
        compte,
        fichier,
        periode_id: periodeId,
        date_debut: dateDebut,
        date_fin: dateFin,
      });
      setCompteActif(compte);
      setEtat(res);
      setPage(res.page || 1);
      setVue("resultats");
      const resume =
        res.comptes.find((c) => c.compte === compte) ?? resumeVide(compte);
      toast.success(
        `${resume.label} importé : ${resume.nombre.toLocaleString("fr-FR")} ligne(s).`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import Excel impossible.");
    } finally {
      setImportEnCours(null);
    }
  }

  async function allerPage(p: number) {
    if (periodeId === "" || p < 1 || (pages > 0 && p > pages)) return;
    await recharger(periodeId, compteActif, p, { conserverVue: true });
  }

  const champRo =
    "flex min-h-[38px] items-center rounded-md border border-[#e2e8f0] bg-[#f8fafc] px-2.5 text-[14px] text-[#0f172a]";
  const champIn =
    "h-[38px] rounded-md border border-[#cbd5e1] bg-white px-2.5 text-[14px] text-[#0f172a] outline-none";

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
        title="Avances au budget"
        description="Source IG. Chaque compte conserve son propre lot actif sur la période : 4701-5* pour l'État, 4706-1* pour le Poste."
        remplace="VIDR 4701-5* / 4706-1* → Avances au budget IG.xlsx"
        actions={
          enVerification || !aDesLots ? null : (
            <button
              type="button"
              onClick={() => setVue("extraction")}
              className="inline-flex h-[38px] items-center gap-2 rounded-md border border-[#cbd5e1] bg-white px-3.5 text-[13.5px] font-semibold text-[#0f172a]"
            >
              Nouvel import
            </button>
          )
        }
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
                    Période du
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
                    Au
                  </span>
                  <input
                    type="date"
                    value={dateFin}
                    onChange={(e) => setDateFin(e.target.value)}
                    className={champIn}
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[12.5px] font-semibold text-[#334155]">
                    Sens
                  </span>
                  <span className={champRo}>Dépenses</span>
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[12.5px] font-semibold text-[#334155]">
                    Mode
                  </span>
                  <span className={champRo}>Numéraire et bancaire</span>
                </label>
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
                {[
                  "Colonnes VIDR.",
                  "Un lot actif distinct par compte et par période.",
                  "Rejet des lignes hors 4701-5* ou 4706-1* selon la zone importée.",
                ].map((c) => (
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
              title="Lots à importer"
              sub="Deux sources VIDR indépendantes"
            >
              <div className="grid gap-3.5" style={{ padding: 16 }}>
                {([
                  [COMPTE_ETAT, "Compte 4701-5*", "État"],
                  [COMPTE_POSTE, "Compte 4706-1*", "Poste"],
                ] as const).map(([compte, libelle, titre]) => {
                  const resume =
                    resumes.find((item) => item.compte === compte) ??
                    resumeVide(compte);
                  const enCours = importEnCours === compte;

                  return (
                    <div
                      key={compte}
                      className="rounded-lg border border-[#bfdccf] bg-[#f7fbf9]"
                      style={{ padding: 16 }}
                    >
                      <div className="mb-3 flex flex-wrap items-start justify-between gap-2.5">
                        <span className="flex flex-col gap-1">
                          <span className="text-[14px] font-semibold text-[#0f172a]">
                            {titre}
                          </span>
                          <span className="text-[12.5px] text-[#64748b]">
                            {libelle} · {resume.nombre.toLocaleString("fr-FR")}{" "}
                            ligne(s) actives
                          </span>
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setCompteActif(compte);
                            if (resume.lot) setVue("resultats");
                          }}
                          className="text-[12.5px] font-semibold text-[#1e6650]"
                        >
                          Voir le lot
                        </button>
                      </div>

                      <div className="grid gap-2.5 sm:grid-cols-2">
                        <button
                          type="button"
                          disabled={!estChef || enCours || periodeId === ""}
                          onClick={() => void importerOracle(compte)}
                          className="inline-flex h-[38px] items-center justify-center gap-2 rounded-md px-3.5 text-[13.5px] font-semibold text-white disabled:opacity-50"
                          style={{ background: SOF_VERT }}
                        >
                          {enCours ? (
                            <Loader2 size={16} className="animate-spin" />
                          ) : (
                            <Database size={16} />
                          )}
                          Extraire Oracle
                        </button>

                        <button
                          type="button"
                          disabled={!estChef || enCours}
                          onClick={() => refsFichiers[compte].current?.click()}
                          className="inline-flex h-[38px] items-center justify-center gap-2 rounded-md border border-dashed border-[#bfdccf] bg-white px-3.5 text-[13.5px] font-semibold text-[#1e6650] disabled:opacity-50"
                        >
                          {enCours ? (
                            <Loader2 size={16} className="animate-spin" />
                          ) : (
                            <Upload size={16} />
                          )}
                          Déposer Excel
                        </button>
                        <input
                          ref={refsFichiers[compte]}
                          type="file"
                          accept=".xlsx,.xls,.csv"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            e.target.value = "";
                            if (f) void importerExcel(compte, f);
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardShell>

            <CardShell
              title="Contrôle des colonnes"
              stretch
              sub={`${COLS_VIDR.length} en-têtes VIDR attendus`}
            >
              <div
                className="flex flex-wrap content-start gap-1.5"
                style={{ padding: "14px 16px" }}
              >
                {COLS_VIDR.map((c) => (
                  <ChipCol key={c} label={c} st="neu" />
                ))}
              </div>
            </CardShell>
          </div>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {resumes.map((resume) => {
              const actif = resume.compte === compteActif;
              const ton = resume.lot ? "#1e6650" : "#94a3b8";
              return (
                <button
                  key={resume.compte}
                  type="button"
                  onClick={() => setCompteActif(resume.compte)}
                  className="inline-flex min-w-[170px] flex-1 items-center justify-between gap-3 rounded-lg border px-3.5 py-3 text-left"
                  style={{
                    borderColor: actif ? "#2a7f62" : "#e2e8f0",
                    background: actif ? "#f0f7f4" : "#fff",
                  }}
                >
                  <span className="flex flex-col gap-0.5">
                    <span className="text-[13px] font-semibold text-[#0f172a]">
                      {resume.label}
                    </span>
                    <span className="text-[12px] text-[#64748b]">
                      {resume.prefixe}*
                    </span>
                  </span>
                  <span
                    className="text-right text-[12px] font-semibold"
                    style={{ color: ton }}
                  >
                    {resume.nombre.toLocaleString("fr-FR")} ligne(s)
                  </span>
                </button>
              );
            })}
          </div>

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
              valeur={resumeActif.nombre.toLocaleString("fr-FR")}
              sous={resumeActif.lot ? "Lot actif" : "Aucun lot actif"}
            />
            <Kpi
              label="Montant total"
              valeur={formatMontant(resumeActif.total)}
              unite="FCFA"
              sous="Somme des montants"
            />
            <Kpi
              label="Première date"
              valeur={dateFr(resumeActif.premiere_date)}
              sous="Date comptable"
            />
            <Kpi
              label="Dernière date"
              valeur={dateFr(resumeActif.derniere_date)}
              sous="Date comptable"
            />
            <Kpi
              label="Lot"
              valeur={resumeActif.lot?.reference ?? "—"}
              sous={resumeActif.lot?.source ?? "Compte non importé"}
            />
          </div>

          <CardShell
            title="Aperçu des lignes"
            sub={`${resumeActif.label} · ${moisPeriodeLibelle(periodeCourante)} · ${PAGE_SIZE} par page`}
            headRight={pages > 1 ? pagination : null}
          >
            <div className="overflow-x-auto">
              <table
                className="w-full border-collapse text-[13px]"
                style={{ minWidth: 1820 }}
              >
                <thead>
                  <tr className="border-b border-[#e2e8f0] bg-[#f8fafc]">
                    {COLS_VIDR.map((c) => (
                      <th
                        key={c}
                        className="px-2.5 py-2 text-[11.5px] font-semibold tracking-[0.04em] whitespace-nowrap text-[#64748b] uppercase"
                        style={{
                          textAlign: estMontantVidr(c) ? "right" : "left",
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
                        colSpan={COLS_VIDR.length}
                        className="px-4 py-6 text-center text-[13.5px] text-[#64748b]"
                      >
                        {resumeActif.lot
                          ? etat?.message ?? "Aucune ligne."
                          : `Aucun lot actif pour ${resumeActif.label.toLowerCase()}.`}
                      </td>
                    </tr>
                  ) : (
                    lignes.map((ligne) => (
                      <tr
                        key={ligne.id}
                        className="border-b border-[#f1f5f9] hover:bg-[#f8fafc]"
                      >
                        {COLS_VIDR.map((c) => (
                          <td
                            key={c}
                            className="px-2.5 py-2 text-[#0f172a]"
                            style={{
                              textAlign: estMontantVidr(c) ? "right" : "left",
                              fontFamily: estMonoVidr(c) ? MONO : undefined,
                              fontVariantNumeric: estMontantVidr(c)
                                ? "tabular-nums"
                                : undefined,
                            }}
                          >
                            {celluleVidr(c, ligne)}
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

function resumeVide(compte: CompteAvanceBudget): ResumeCompteAvanceBudget {
  if (compte === COMPTE_ETAT) {
    return {
      compte,
      prefixe: "4701-5",
      code: "4701",
      label: "État",
      source: "ig-avances-4701",
      lot: null,
      nombre: 0,
      total: "0.00",
      premiere_date: null,
      derniere_date: null,
      nb_anomalies: 0,
    };
  }

  return {
    compte,
    prefixe: "4706-1",
    code: "4706",
    label: "Poste",
    source: "ig-avances-4706",
    lot: null,
    nombre: 0,
    total: "0.00",
    premiere_date: null,
    derniere_date: null,
    nb_anomalies: 0,
  };
}
