import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Check,
  Database,
  Loader2,
  Minus,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { SofPageHeader } from "@/portails/Sof/components/layout/SofPageHeader";
import {
  importerOperationsIgDouanes,
  listerGrilleDouanes,
  type LigneGrilleDouane,
  type RusidSynthese,
} from "@/portails/Sof/api/ig-operations-douanes";
import { listerPeriodes } from "@/portails/Sof/api/referentiel";
import type { PeriodeSof } from "@/portails/Sof/types/referentiel.interface";
import { useAuth } from "@/shared/hooks/use-auth";
import { formatMontant } from "@/shared/lib/format";

/** Colonnes VIDR (sof-data.js). */
const COLS_VIDR = [
  "C_PCA",
  "D_CPTA",
  "N_REGL",
  "N_LIG_R",
  "C_TYP_OP",
  "N_OP",
  "C_GUIC",
  "N_MATTIR",
  "L_NP",
  "C_OPE",
  "C_IT",
  "C_NAT",
  "C_REF1",
  "C_REF2",
  "M_REGL",
  "C_NOP",
  "C_MDR",
  "N_CHEQ",
  "C_CAIS",
] as const;

const GRILLE = "110px minmax(220px, 2fr) 170px 170px";
const SOF_VERT = "#2a7f62";

type ModeImport = "ora" | "xls";
type StatutLot = "manquant" | "chargé" | "reçu";

type LigneAffichee = {
  compte: string;
  libelle: string;
  montant: string;
  bancaire: boolean;
};

function isoPremierDuMois(annee: number, mois: number): string {
  return `${annee}-${String(mois).padStart(2, "0")}-01`;
}

function isoFinDuMois(annee: number, mois: number): string {
  const fin = new Date(annee, mois, 0);
  return `${fin.getFullYear()}-${String(fin.getMonth() + 1).padStart(2, "0")}-${String(fin.getDate()).padStart(2, "0")}`;
}

function dateFrIso(iso: string): string {
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

function libelleMaquette(compte: string, fallback: string): string {
  if (compte.startsWith("4663")) return "RUSID";
  if (compte.startsWith("1812")) return "Transferts douanes";
  if (compte.startsWith("4784")) return "Recettes douanes";
  return fallback;
}

function CardShell({
  title,
  sub,
  headRight,
  children,
  tone,
  stretch,
}: {
  title: string;
  sub?: string;
  headRight?: ReactNode;
  children: ReactNode;
  tone?: { bg: string; bd: string };
  stretch?: boolean;
}) {
  return (
    <section
      className={`flex min-w-0 flex-col overflow-hidden rounded-lg border${stretch ? " flex-1" : ""}`}
      style={{
        background: tone?.bg ?? "#fff",
        borderColor: tone?.bd ?? "#e2e8f0",
      }}
    >
      <div
        className="flex flex-wrap items-center justify-between gap-2.5 border-b border-[#e2e8f0]"
        style={{ padding: "12px 16px" }}
      >
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="text-[15px] font-semibold text-[#0f172a]">
            {title}
          </span>
          {sub ? (
            <span className="text-[12.5px] text-[#64748b]">{sub}</span>
          ) : null}
        </span>
        {headRight ? (
          <div className="flex flex-wrap items-center gap-2">{headRight}</div>
        ) : null}
      </div>
      <div className={stretch ? "min-h-0 flex-1" : undefined}>{children}</div>
    </section>
  );
}

function ChipCol({
  label,
  st,
}: {
  label: string;
  st: "ok" | "ko" | "neu";
}) {
  const T = {
    ok: { bd: "#bfdccf", bg: "#f0f7f4", fg: "#1e6650", Icon: Check },
    ko: { bd: "#fecaca", bg: "#fee2e2", fg: "#b91c1c", Icon: X },
    neu: { bd: "#e2e8f0", bg: "#f8fafc", fg: "#64748b", Icon: Minus },
  }[st];
  return (
    <span
      className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[12px]"
      style={{
        border: `1px solid ${T.bd}`,
        background: T.bg,
        color: T.fg,
        fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
      }}
    >
      <T.Icon size={12} strokeWidth={2.5} />
      {label}
    </span>
  );
}

function TagOps({ bancaire }: { bancaire: boolean }) {
  return (
    <span
      className="inline-flex h-[22px] items-center rounded px-2 text-[11.5px] font-semibold whitespace-nowrap"
      style={
        bancaire
          ? { background: "#e3f1ea", color: "#1e6650" }
          : { background: "#f1f5f9", color: "#475569" }
      }
    >
      {bancaire ? "Bancaires seulement" : "Toutes"}
    </span>
  );
}

function Kpi({
  label,
  valeur,
  unite,
  sous,
  accent = SOF_VERT,
  fg = "#0f172a",
}: {
  label: string;
  valeur: string;
  unite?: string;
  sous: string;
  accent?: string;
  fg?: string;
}) {
  return (
    <div
      className="flex flex-col gap-1.5 rounded-lg border border-[#e2e8f0] bg-white"
      style={{ padding: "14px 16px", borderTop: `3px solid ${accent}` }}
    >
      <span className="text-[11.5px] font-semibold tracking-[0.06em] text-[#64748b] uppercase">
        {label}
      </span>
      <span className="flex flex-wrap items-baseline gap-1.5">
        <span
          className="text-[21px] font-semibold"
          style={{ fontVariantNumeric: "tabular-nums", color: fg }}
        >
          {valeur}
        </span>
        {unite ? (
          <span className="text-[12px] font-medium text-[#64748b]">{unite}</span>
        ) : null}
      </span>
      <span className="text-[12.5px] text-[#64748b]">{sous}</span>
    </div>
  );
}

export default function ComptesDouanes() {
  const { hasAnyRole } = useAuth();
  const estChef = hasAnyRole(["CHEF_SOF"]);

  const [periodes, setPeriodes] = useState<PeriodeSof[]>([]);
  const [periodeId, setPeriodeId] = useState<number | "">("");
  const [exercice, setExercice] = useState("2026");
  const [dateDebut, setDateDebut] = useState("");
  const [dateFin, setDateFin] = useState("");

  const [mode, setMode] = useState<ModeImport>("ora");
  const [statut, setStatut] = useState<StatutLot>("manquant");
  /** Vues exclusives : paramètres d'extraction XOR résultats (+ Annuler / Valider). */
  const [vue, setVue] = useState<"extraction" | "resultats">("extraction");

  const [lignes, setLignes] = useState<LigneGrilleDouane[]>([]);
  const [rusid, setRusid] = useState<RusidSynthese | null>(null);
  /** false tant que le 1er chargement (ou changement de période) n’a pas répondu. */
  const [etatPret, setEtatPret] = useState(false);

  const [chargement, setChargement] = useState(true);
  const [importEnCours, setImportEnCours] = useState(false);

  const exercices = useMemo(() => {
    const ans = [...new Set(periodes.map((p) => p.exercice_annee))].sort(
      (a, b) => b - a,
    );
    return ans.length ? ans.map(String) : ["2026"];
  }, [periodes]);

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
          setDateDebut(
            isoPremierDuMois(liste[0].exercice_annee, liste[0].mois),
          );
          setDateFin(isoFinDuMois(liste[0].exercice_annee, liste[0].mois));
        }
      })
      .catch((e) =>
        toast.error(e instanceof Error ? e.message : "Périodes indisponibles."),
      );
  }, []);

  async function rechargerGrille(
    pid: number,
    options?: { ouvrirResultatsSiDonnees?: boolean },
  ) {
    setChargement(true);
    try {
      const res = await listerGrilleDouanes(pid);
      setLignes(res.lignes);
      setRusid(res.rusid);
      const aDonnees =
        res.lignes.some(
          (l) =>
            l.lot != null ||
            l.nb_lignes > 0 ||
            Number(l.montant) !== 0,
        ) || Number(res.rusid?.montant ?? 0) !== 0;
      setStatut((prev) =>
        prev === "chargé" ? "chargé" : aDonnees ? "reçu" : "manquant",
      );
      if (options?.ouvrirResultatsSiDonnees && aDonnees) {
        setVue("resultats");
        setStatut("reçu");
      } else if (options?.ouvrirResultatsSiDonnees && !aDonnees) {
        setVue("extraction");
        setStatut("manquant");
      }
      setEtatPret(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Chargement impossible.");
      setEtatPret(true);
    } finally {
      setChargement(false);
    }
  }

  useEffect(() => {
    if (periodeId === "") return;
    void rechargerGrille(periodeId, { ouvrirResultatsSiDonnees: true });
  }, [periodeId]);

  const chipSt: "ok" | "neu" = vue === "resultats" ? "ok" : "neu";
  const stLib =
    statut === "reçu"
      ? "reçu"
      : statut === "chargé"
        ? "chargé · à valider"
        : "manquant";

  const grille: LigneAffichee[] = useMemo(() => {
    const rows: LigneAffichee[] = lignes.map((l) => ({
      compte: l.compte,
      libelle: libelleMaquette(l.compte, l.libelle),
      montant: l.montant,
      bancaire: l.bancaire_seulement,
    }));
    rows.push({
      compte: rusid?.compte ?? "4663-218",
      libelle: "RUSID",
      montant: rusid?.montant ?? "0.00",
      bancaire: false,
    });
    return rows;
  }, [lignes, rusid]);

  const totaux = useMemo(() => {
    const nb = lignes.reduce((s, l) => s + l.nb_lignes, 0);
    let montant = 0;
    for (const l of lignes) {
      montant += Number(String(l.montant).replace(/\s/g, "").replace(",", ".")) || 0;
    }
    montant +=
      Number(String(rusid?.montant ?? "0").replace(/\s/g, "").replace(",", ".")) ||
      0;
    return { nb, montant };
  }, [lignes, rusid]);

  function appliquerPeriode(p: PeriodeSof) {
    setPeriodeId(p.id);
    setExercice(String(p.exercice_annee));
    setDateDebut(isoPremierDuMois(p.exercice_annee, p.mois));
    setDateFin(isoFinDuMois(p.exercice_annee, p.mois));
    setStatut("manquant");
    setEtatPret(false);
  }

  /** Aligne la période SROT sur les dates d'extraction (maquette). */
  function resoudrePeriodeDepuisDates(debut: string, anneeStr: string) {
    const parts = debut.split("-");
    const mois = parts[1] ? Number(parts[1]) : NaN;
    const annee = Number(anneeStr);
    if (!Number.isFinite(mois) || !Number.isFinite(annee)) return;
    const p = periodes.find(
      (x) => x.exercice_annee === annee && x.mois === mois,
    );
    if (p) {
      setPeriodeId(p.id);
      setStatut("manquant");
      setVue("extraction");
    }
  }

  async function extraireOracle() {
    if (!estChef || periodeId === "") return;
    setImportEnCours(true);
    try {
      const res = await importerOperationsIgDouanes({
        date_debut: dateDebut,
        date_fin: dateFin,
        periode_id: periodeId,
      });
      const n = res.comptes.reduce((s, c) => s + c.nb_lignes, 0);
      toast.success(
        `Fichier chargé : ${n} opération(s) · vérifiez l'aperçu puis validez l'import.`,
      );
      await rechargerGrille(periodeId);
      setStatut("chargé");
      setVue("resultats");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import impossible.");
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

  function nouvelleExtraction() {
    setVue("extraction");
  }

  const champRo =
    "flex min-h-[38px] items-center rounded-md border border-[#e2e8f0] bg-[#f8fafc] px-2.5 text-[14px] text-[#0f172a]";
  const champIn =
    "h-[38px] rounded-md border border-[#cbd5e1] bg-white px-2.5 text-[14px] text-[#0f172a] outline-none";

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
          style={{
            background: SOF_VERT,
            border: `1px solid ${SOF_VERT}`,
          }}
        >
          <Check size={16} strokeWidth={2.4} />
          Valider l&apos;import
        </button>
      </>
    ) : vue === "resultats" ? (
      <button
        type="button"
        onClick={nouvelleExtraction}
        className="inline-flex h-[38px] items-center gap-2 rounded-md border border-[#cbd5e1] bg-white px-3.5 text-[13.5px] font-semibold text-[#0f172a]"
      >
        Nouvelle extraction
      </button>
    ) : null;

  return (
    <div className="flex flex-col gap-[18px]">
      <SofPageHeader
        title="Comptes douanes"
        description="Source IG. L'import validé remplace le lot précédent de la même source et de la même période."
        remplace="VIDR 4784-*, 1812-1* · MCPT 4663-218"
        actions={!etatPret ? null : actionsHeader}
      />

      {!etatPret ? (
        <div className="flex min-h-[220px] items-center justify-center gap-2 text-[13.5px] text-[#64748b]">
          <Loader2 size={18} className="animate-spin" />
          Vérification des données…
        </div>
      ) : vue === "extraction" ? (
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
                  onChange={(e) => {
                    const v = e.target.value;
                    setDateDebut(v);
                    resoudrePeriodeDepuisDates(v, exercice);
                  }}
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
              <label className="flex flex-col gap-1.5" style={{ gridColumn: "1 / -1" }}>
                <span className="text-[12.5px] font-semibold text-[#334155]">
                  Comptes
                </span>
                <span className={champRo}>
                  4784-101 à 111, 4784-201 à 211, 4784-31, 1812-101 à 111
                </span>
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[12.5px] font-semibold text-[#334155]">
                  RUSID
                </span>
                <span className={champRo}>4663-218</span>
              </label>
            </div>
          </CardShell>

          <CardShell
            title="Contrôles appliqués"
            tone={{ bg: "#f0f7f4", bd: "#bfdccf" }}
          >
            <div className="flex flex-col gap-2" style={{ padding: "14px 16px" }}>
              {[
                "Colonnes VIDR",
                "4784-1* en opérations bancaires seulement.",
              ].map((t) => (
                <div
                  key={t}
                  className="flex gap-2.5 text-[13.5px] leading-[1.55]"
                  style={{ color: "#1e6650" }}
                >
                  <span
                    className="mt-[9px] size-[5px] flex-none rounded-full"
                    style={{ background: "#2a7f62" }}
                  />
                  <span>{t}</span>
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
                    <span
                      style={{
                        fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
                        color: "#1e6650",
                      }}
                    >
                      VIDR / MCPT · Comptes douanes
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
                <button
                  type="button"
                  disabled={!estChef}
                  onClick={() =>
                    toast.message(
                      "Dépôt Excel : utilisez Extraire depuis Oracle pour cette source.",
                    )
                  }
                  className="flex flex-col items-center gap-1.5 rounded-lg border-[1.5px] border-dashed border-[#bfdccf] bg-[#f7fbf9] text-center hover:border-[#2a7f62] disabled:opacity-50"
                  style={{ padding: "20px 12px" }}
                >
                  <Upload size={18} className="text-[#1e6650]" />
                  <span className="text-[13.5px] font-semibold text-[#0f172a]">
                    Fichier Excel
                  </span>
                  <span className="text-[12px] text-[#64748b]">
                    Déposez le fichier Excel ou cliquez pour parcourir
                  </span>
                </button>
              )}
            </div>
          </CardShell>

          <CardShell
            title="Contrôle des colonnes"
            stretch
            sub={
              chipSt === "ok"
                ? `${COLS_VIDR.length} en-têtes attendus · statut ${stLib}`
                : "En attente d'un fichier"
            }
          >
            <div
              className="flex flex-wrap content-start gap-1.5"
              style={{ padding: "14px 16px" }}
            >
              {COLS_VIDR.map((c) => (
                <ChipCol key={c} label={c} st={chipSt} />
              ))}
            </div>
          </CardShell>
        </div>
      </div>
      ) : null}

      {vue === "resultats" ? (
        <>
          <div
            className="grid gap-3"
            style={{
              gridTemplateColumns:
                "repeat(auto-fit, minmax(min(100%, 170px), 1fr))",
            }}
          >
            <Kpi
              label="Lignes"
              valeur={totaux.nb.toLocaleString("fr-FR")}
              sous={
                statut === "chargé" ? "Lot en attente" : "Lot actif"
              }
            />
            <Kpi
              label="Montant total"
              valeur={formatMontant(String(totaux.montant))}
              unite="FCFA"
              sous="Somme des montants"
            />
            <Kpi
              label="Première date"
              valeur={dateDebut ? dateFrIso(dateDebut) : "—"}
              sous="Date comptable"
            />
            <Kpi
              label="Dernière date"
              valeur={dateFin ? dateFrIso(dateFin) : "—"}
              sous="Date comptable"
            />
            <Kpi
              label="Vs import précédent"
              valeur="—"
              sous="Comparaison non disponible"
            />
          </div>

          <CardShell title="Grille compte × montant du mois">
            {chargement ? (
              <div className="flex min-h-[160px] items-center justify-center gap-2 text-[13px] text-[#64748b]">
                <Loader2 size={16} className="animate-spin" /> Chargement…
              </div>
            ) : (
              <div className="overflow-x-auto">
                <div style={{ minWidth: 640 }}>
                  <div
                    className="grid border-b border-[#e2e8f0] bg-[#f8fafc]"
                    style={{ gridTemplateColumns: GRILLE }}
                  >
                    {(
                      [
                        ["Compte", "flex-start"],
                        ["Libellé", "flex-start"],
                        ["Montant du mois", "flex-end"],
                        ["Opérations", "flex-start"],
                      ] as const
                    ).map(([l, jc]) => (
                      <div
                        key={l}
                        className="px-2.5 py-[9px] text-[11px] font-semibold tracking-[0.05em] text-[#64748b] uppercase"
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: jc,
                        }}
                      >
                        {l}
                      </div>
                    ))}
                  </div>
                  {grille.map((l) => (
                    <div
                      key={l.compte}
                      className="grid min-h-[42px] border-b border-[#eef2f4] text-[13px]"
                      style={{ gridTemplateColumns: GRILLE }}
                    >
                      <div
                        className="flex items-center px-2.5 py-1.5"
                        style={{
                          fontFamily:
                            '"IBM Plex Mono", ui-monospace, monospace',
                        }}
                      >
                        {l.compte}
                      </div>
                      <div className="flex min-w-0 items-center px-2.5 py-1.5">
                        <span className="truncate">{l.libelle}</span>
                      </div>
                      <div
                        className="flex items-center justify-end px-2.5 py-1.5"
                        style={{
                          fontFamily:
                            '"IBM Plex Mono", ui-monospace, monospace',
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {formatMontant(l.montant)}
                      </div>
                      <div className="flex items-center px-2.5 py-1.5">
                        <TagOps bancaire={l.bancaire} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardShell>

          <CardShell
            title="Anomalies"
            sub="Aucune anomalie détectée"
          >
            <div
              className="text-center text-[13.5px] text-[#64748b]"
              style={{ padding: "24px 16px" }}
            >
              Aucune anomalie : toutes les lignes respectent les contrôles.
            </div>
          </CardShell>
        </>
      ) : null}

    </div>
  );
}
