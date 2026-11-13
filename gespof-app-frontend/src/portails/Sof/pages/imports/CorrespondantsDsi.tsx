import { useEffect, useRef, useState } from "react";
import { Check, Loader2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { SofPageHeader } from "@/portails/Sof/components/layout/SofPageHeader";
import { SofSeg } from "@/portails/Sof/components/SofSeg";
import { SofUniteSeg } from "@/portails/Sof/components/SofUniteSeg";
import {
  CardShell,
  ChipCol,
  Kpi,
  MONO,
  SOF_VERT,
  SofBarreFiltres,
  SofPeriodeSelect,
  moisPeriodeLibelle,
  usePeriodesSof,
} from "@/portails/Sof/components/SofCards";
import {
  importerExcelCorrespondants,
  obtenirEtatCorrespondants,
  type EtatCorrespondantsImport,
  type SensCorrespondant,
} from "@/portails/Sof/api/correspondants";
import {
  formaterSelonUnite,
  type UniteMontant,
} from "@/portails/Sof/lib/unite-montant";
import { useAuth } from "@/shared/hooks/use-auth";

/** Colonnes attendues (maquette sof-data.js srv-correspondants). */
const COLONNES = [
  "CATÉGORIE",
  "C_IT",
  "LIBELLÉ",
  "M01",
  "M02",
  "M03",
  "M04",
  "M05",
  "M06",
  "M07",
  "M08",
  "M09",
  "M10",
  "M11",
  "M12",
] as const;

const GRILLE_COLS = `140px 100px minmax(200px, 1.4fr) repeat(12, minmax(96px, 1fr)) 120px`;

type StatutLot = "manquant" | "chargé" | "reçu";

function aDesDonnees(etat: EtatCorrespondantsImport | null): boolean {
  if (!etat) return false;
  return (["DEPENSE", "RECETTE"] as const).some((s) => {
    const o = etat.onglets?.[s];
    return (o?.nombre ?? 0) > 0 || o?.lot != null;
  });
}

function etatVide(): EtatCorrespondantsImport {
  return {
    periode: null,
    source: "srv-correspondants",
    format: "F10",
    colonnes: [...COLONNES],
    onglets: {},
    message: null,
  };
}

export default function CorrespondantsDsi() {
  const { hasAnyRole } = useAuth();
  const estChef = hasAnyRole(["CHEF_SOF"]);
  const fileRef = useRef<HTMLInputElement>(null);
  const { periodes, periodeId, setPeriodeId, periode } = usePeriodesSof();

  const [sens, setSens] = useState<SensCorrespondant>("DEPENSE");
  const [unite, setUnite] = useState<UniteMontant>("M");
  const [statut, setStatut] = useState<StatutLot>("manquant");
  const [vue, setVue] = useState<"extraction" | "resultats">("extraction");
  const [etat, setEtat] = useState<EtatCorrespondantsImport | null>(null);
  const [chargement, setChargement] = useState(true);
  const [importEnCours, setImportEnCours] = useState(false);

  const aResultats = aDesDonnees(etat);
  const afficherResultats = vue === "resultats" && aResultats;
  const enVerification = etat === null;

  async function recharger(
    pid: number,
    options?: { ouvrirResultatsSiDonnees?: boolean; garderCharge?: boolean },
  ) {
    setChargement(true);
    try {
      const res = await obtenirEtatCorrespondants({ periode_id: pid });
      setEtat(res);
      const ok = aDesDonnees(res);
      if (options?.garderCharge && ok) {
        setStatut("chargé");
        setVue("resultats");
      } else if (options?.ouvrirResultatsSiDonnees) {
        if (ok) {
          setStatut((prev) => (prev === "chargé" ? "chargé" : "reçu"));
          setVue("resultats");
        } else {
          setStatut("manquant");
          setVue("extraction");
        }
      } else if (ok) {
        setStatut((prev) => (prev === "chargé" ? "chargé" : "reçu"));
      } else if (!options?.garderCharge) {
        setStatut("manquant");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Chargement impossible.");
      setEtat((prev) => prev ?? etatVide());
      setVue("extraction");
      setStatut("manquant");
    } finally {
      setChargement(false);
    }
  }

  useEffect(() => {
    if (periodeId === "") return;
    setEtat(null);
    void recharger(periodeId, { ouvrirResultatsSiDonnees: true });
  }, [periodeId]);

  async function chargerExcel(file: File) {
    if (!estChef || periodeId === "") return;
    setImportEnCours(true);
    try {
      const res = await importerExcelCorrespondants({
        fichier: file,
        periode_id: periodeId,
        sens,
      });
      setEtat(res);
      const ok = aDesDonnees(res);
      if (ok) {
        setStatut("chargé");
        setVue("resultats");
        const nb = Object.values(res.imports ?? {}).reduce(
          (s, i) => s + i.nb_lignes,
          0,
        );
        toast.success(
          `Fichier chargé : ${nb.toLocaleString("fr-FR")} ligne(s) · onglets ${Object.keys(
            res.imports ?? {},
          )
            .map((k) => (k === "RECETTE" ? "Recettes" : "Dépenses"))
            .join(" + ")}.`,
        );
      } else {
        setStatut("manquant");
        setVue("extraction");
        toast.message("Aucune ligne importée.");
      }
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

  function nouvelleExtraction() {
    setVue("extraction");
  }

  const onglet = etat?.onglets?.[sens] ?? null;
  const lignes = onglet?.lignes ?? [];
  const anomalies = onglet?.anomalies ?? [];
  const lot = onglet?.lot ?? null;
  const chipSt: "ok" | "neu" = lot || aResultats ? "ok" : "neu";

  const totauxMois = Array.from({ length: 12 }, (_, i) =>
    lignes.reduce((s, l) => s + Number(l.mois[i] ?? 0), 0),
  );
  const totalGeneral = totauxMois.reduce((s, v) => s + v, 0);

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
        onClick={nouvelleExtraction}
        className="inline-flex h-[38px] items-center gap-2 rounded-md border border-[#cbd5e1] bg-white px-3.5 text-[13.5px] font-semibold text-[#0f172a]"
      >
        Nouvelle extraction
      </button>
    ) : null;

  return (
    <div className="flex flex-col gap-[18px]">
      <SofPageHeader
        title="Correspondants (DSI)"
        description="Source Service · DSI. Deux onglets : dépenses et recettes. L'import validé remplace le lot précédent du même sens et de la même période."
        remplace="F10 · Correspondants DSI.xlsx"
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
                <SofPeriodeSelect
                  periodes={periodes}
                  value={periodeId}
                  onChange={(id) => {
                    setPeriodeId(id);
                    setEtat(null);
                  }}
                />
                <SofSeg
                  label="Sens (fichier à 1 onglet)"
                  options={[
                    { cle: "DEPENSE", libelle: "Dépenses" },
                    { cle: "RECETTE", libelle: "Recettes" },
                  ]}
                  value={sens}
                  onChange={(c) => setSens(c as SensCorrespondant)}
                />
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
                <div
                  className="flex gap-2.5 text-[13.5px] leading-[1.55]"
                  style={{ color: "#1e6650" }}
                >
                  <span
                    className="mt-[9px] size-[5px] flex-none rounded-full"
                    style={{ background: SOF_VERT }}
                  />
                  <span>Catégorie inconnue signalée</span>
                </div>
                <div
                  className="flex gap-2.5 text-[13.5px] leading-[1.55]"
                  style={{ color: "#1e6650" }}
                >
                  <span
                    className="mt-[9px] size-[5px] flex-none rounded-full"
                    style={{ background: SOF_VERT }}
                  />
                  <span>
                    Deux onglets attendus : « Dépenses » et « Recettes »
                  </span>
                </div>
              </div>
            </CardShell>
          </div>

          <div
            className="flex min-w-0 flex-1 flex-col gap-[18px]"
            style={{ flex: "1 1 420px" }}
          >
            <CardShell
              title="Mode d'import"
              sub="Fichier Excel uniquement · montants en millions de FCFA"
            >
              <div className="flex flex-col gap-3.5" style={{ padding: 16 }}>
                <button
                  type="button"
                  disabled={!estChef || importEnCours || periodeId === ""}
                  onClick={() => fileRef.current?.click()}
                  title={estChef ? undefined : "Réservé au Chef SOF"}
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
                <span className="text-[12.5px] text-[#64748b]">
                  Nommez les onglets « Dépenses » et « Recettes ». Pour un
                  classeur à un seul onglet, le sens sélectionné est appliqué.
                </span>
              </div>
            </CardShell>

            <CardShell
              title="Contrôle des colonnes"
              stretch
              sub={
                chipSt === "ok"
                  ? `${COLONNES.length} en-têtes attendus`
                  : "En attente d'un fichier"
              }
            >
              <div
                className="flex flex-wrap content-start gap-1.5"
                style={{ padding: "14px 16px" }}
              >
                {COLONNES.map((c) => (
                  <ChipCol key={c} label={c} st={chipSt} />
                ))}
              </div>
            </CardShell>
          </div>
        </div>
      ) : (
        <>
          <SofBarreFiltres>
            <SofPeriodeSelect
              periodes={periodes}
              value={periodeId}
              onChange={(id) => {
                setPeriodeId(id);
                setEtat(null);
              }}
            />
            <SofSeg
              label="Sens"
              options={[
                { cle: "DEPENSE", libelle: "Dépenses" },
                { cle: "RECETTE", libelle: "Recettes" },
              ]}
              value={sens}
              onChange={(c) => setSens(c as SensCorrespondant)}
            />
            <span className="flex-1" />
            <SofUniteSeg value={unite} onChange={setUnite} />
          </SofBarreFiltres>

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
              valeur={(onglet?.nombre ?? 0).toLocaleString("fr-FR")}
              sous={
                statut === "chargé"
                  ? "Lot en attente"
                  : sens === "RECETTE"
                    ? "Onglet Recettes"
                    : "Onglet Dépenses"
              }
            />
            <Kpi
              label="Total"
              valeur={formaterSelonUnite(onglet?.total ?? "0", unite)}
              unite={
                unite === "F" ? "FCFA" : unite === "M" ? "M FCFA" : "Md FCFA"
              }
              sous="Somme des 12 mois"
            />
            <Kpi
              label="Anomalies"
              valeur={String(anomalies.length)}
              sous={anomalies.length ? "À corriger" : "Aucune"}
              accent={anomalies.length ? "#b45309" : SOF_VERT}
              fg={anomalies.length ? "#b91c1c" : "#0f172a"}
            />
          </div>

          <CardShell
            title={`Correspondants · ${sens === "RECETTE" ? "recettes" : "dépenses"}`}
            sub={
              lot
                ? `Lot actif pour ${moisPeriodeLibelle(periode)}`
                : "Aucun lot actif pour ce sens"
            }
          >
            {lignes.length === 0 ? (
              <div className="px-4 py-6 text-center text-[13.5px] text-[#64748b]">
                Aucune ligne pour ce sens.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <div style={{ minWidth: 1640 }}>
                  <div
                    className="grid border-b border-[#e2e8f0] bg-[#f8fafc] text-[11px] font-semibold tracking-[0.05em] text-[#64748b] uppercase"
                    style={{ gridTemplateColumns: GRILLE_COLS }}
                  >
                    {[...COLONNES, "TOTAL"].map((c, i) => (
                      <div
                        key={c}
                        className="px-2.5 py-2"
                        style={{
                          textAlign: i >= 3 ? "right" : "left",
                          fontFamily: i >= 3 ? MONO : undefined,
                        }}
                      >
                        {c}
                      </div>
                    ))}
                  </div>
                  {lignes.map((l, idx) => (
                    <div
                      key={`${l.categorie}|${l.compte}|${l.libelle}|${idx}`}
                      className="grid border-b border-[#eef2f4] text-[13px] hover:bg-[#f8fafc]"
                      style={{ gridTemplateColumns: GRILLE_COLS }}
                    >
                      <div className="truncate px-2.5 py-2">
                        {l.categorie ?? "—"}
                      </div>
                      <div className="px-2.5 py-2" style={{ fontFamily: MONO }}>
                        {l.compte ?? "—"}
                      </div>
                      <div className="truncate px-2.5 py-2">
                        {l.libelle ?? "—"}
                      </div>
                      {l.mois.map((m, i) => (
                        <div
                          key={i}
                          className="px-2.5 py-2 text-right"
                          style={{
                            fontFamily: MONO,
                            fontVariantNumeric: "tabular-nums",
                          }}
                        >
                          {formaterSelonUnite(m, unite)}
                        </div>
                      ))}
                      <div
                        className="px-2.5 py-2 text-right font-semibold"
                        style={{
                          fontFamily: MONO,
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {formaterSelonUnite(l.total, unite)}
                      </div>
                    </div>
                  ))}
                  <div
                    className="grid text-[13px] font-semibold"
                    style={{
                      gridTemplateColumns: GRILLE_COLS,
                      background: "#e3f1ea",
                      borderTop: "1px solid #bfdccf",
                    }}
                  >
                    <div className="px-2.5 py-2" />
                    <div className="px-2.5 py-2" />
                    <div className="px-2.5 py-2">Total</div>
                    {totauxMois.map((v, i) => (
                      <div
                        key={i}
                        className="px-2.5 py-2 text-right"
                        style={{
                          fontFamily: MONO,
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {formaterSelonUnite(v, unite)}
                      </div>
                    ))}
                    <div
                      className="px-2.5 py-2 text-right"
                      style={{
                        fontFamily: MONO,
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {formaterSelonUnite(totalGeneral, unite)}
                    </div>
                  </div>
                </div>
              </div>
            )}
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
                Aucune anomalie : toutes les catégories sont connues.
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
