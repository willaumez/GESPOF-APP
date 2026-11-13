import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { SofPageHeader } from "@/portails/Sof/components/layout/SofPageHeader";
import {
  importerRecapBeac,
  obtenirRecapBeac,
  type LigneRecapBeac,
  type RecapBeacSof,
} from "@/portails/Sof/api/recap-beac";
import {
  importerOperationsIgPetrole,
  listerFeuillesIgPetrole,
  obtenirFeuilleIgPetrole,
  type FeuilleIgPetrole,
  type LigneIgOperation,
} from "@/portails/Sof/api/ig-operations-petrole";
import { listerPeriodes } from "@/portails/Sof/api/referentiel";
import type { PeriodeSof } from "@/portails/Sof/types/referentiel.interface";
import { useAuth } from "@/shared/hooks/use-auth";
import { formatMontant } from "@/shared/lib/format";
import { cn } from "@/shared/lib/utils";

type Onglet = "beac" | "operations";

const GRILLE_BEAC = "90px minmax(240px, 2fr) 130px 160px";
const GRILLE_OP =
  "88px 100px 100px 90px minmax(140px, 1.2fr) 80px 70px 120px";

const champCls =
  "h-[34px] rounded-md border border-[#cbd5e1] bg-white px-2.5 text-[13px] text-[#0f172a] outline-none";

function dateFr(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

function isoPremierDuMois(annee: number, mois: number): string {
  return `${annee}-${String(mois).padStart(2, "0")}-01`;
}

function TagNature({ petrole, libelle }: { petrole: boolean; libelle: string }) {
  return (
    <span
      className="inline-flex h-[22px] items-center rounded-full px-2 text-[11.5px] font-semibold"
      style={
        petrole
          ? { background: "#ecfdf5", color: "#047857" }
          : { background: "#f1f5f9", color: "#475569" }
      }
    >
      {libelle}
    </span>
  );
}

function TagNop({ nop }: { nop: string | null }) {
  const lib =
    nop === "B" ? "Bancaire" : nop === "N" ? "Numéraire" : (nop ?? "—");
  return (
    <span className="text-[12.5px] text-[#475569] whitespace-nowrap">{lib}</span>
  );
}

export default function ComptesPetrole() {
  const { hasAnyRole } = useAuth();
  const estChef = hasAnyRole(["CHEF_SOF"]);

  const [onglet, setOnglet] = useState<Onglet>("beac");
  const [periodes, setPeriodes] = useState<PeriodeSof[]>([]);
  const [periodeId, setPeriodeId] = useState<number | "">("");
  const [dateDebut, setDateDebut] = useState("");
  const [dateFin, setDateFin] = useState("");

  const [dataBeac, setDataBeac] = useState<RecapBeacSof | null>(null);
  const [feuilles, setFeuilles] = useState<FeuilleIgPetrole[]>([]);
  const [feuilleCle, setFeuilleCle] = useState<string>("");
  const [lignesOp, setLignesOp] = useState<LigneIgOperation[]>([]);
  const [totalOp, setTotalOp] = useState("0");
  const [msgOp, setMsgOp] = useState<string | null>(null);

  const [chargement, setChargement] = useState(true);
  const [importEnCours, setImportEnCours] = useState(false);

  const periodeSel = useMemo(
    () => periodes.find((p) => p.id === periodeId) ?? null,
    [periodes, periodeId],
  );

  const feuilleSel = useMemo(
    () => feuilles.find((f) => f.cle === feuilleCle) ?? null,
    [feuilles, feuilleCle],
  );

  useEffect(() => {
    let actif = true;
    listerPeriodes()
      .then((res) => {
        if (!actif) return;
        const liste = [...(res.periodes ?? [])].sort((a, b) => {
          if (a.exercice_annee !== b.exercice_annee) {
            return b.exercice_annee - a.exercice_annee;
          }
          return b.mois - a.mois;
        });
        setPeriodes(liste);
        const courante = liste[0];
        if (courante) {
          setPeriodeId(courante.id);
          setDateDebut(
            isoPremierDuMois(courante.exercice_annee, courante.mois),
          );
          setDateFin(
            courante.date_situation ??
              isoPremierDuMois(courante.exercice_annee, courante.mois),
          );
        }
      })
      .catch((e) =>
        toast.error(
          e instanceof Error ? e.message : "Impossible de charger les périodes.",
        ),
      );
    return () => {
      actif = false;
    };
  }, []);

  async function chargerBeac(pid: number) {
    const res = await obtenirRecapBeac(pid);
    setDataBeac(res);
    if (res.date_debut) setDateDebut(res.date_debut);
    if (res.date_fin) setDateFin(res.date_fin);
  }

  async function chargerFeuilles(pid: number) {
    const res = await listerFeuillesIgPetrole(pid);
    setFeuilles(res.feuilles ?? []);
    const premiere = res.feuilles?.[0];
    const cle =
      feuilleCle && res.feuilles?.some((f) => f.cle === feuilleCle)
        ? feuilleCle
        : (premiere?.cle ?? "");
    setFeuilleCle(cle);
    if (cle && premiere) {
      const f =
        res.feuilles.find((x) => x.cle === cle) ?? premiere;
      await chargerDetailFeuille(pid, f.compte, f.nature);
    } else {
      setLignesOp([]);
      setTotalOp("0");
      setMsgOp(res.message);
    }
  }

  async function chargerDetailFeuille(
    pid: number,
    compte: string,
    nature: string | null,
  ) {
    const res = await obtenirFeuilleIgPetrole({
      compte,
      nature,
      periode_id: pid,
    });
    setLignesOp(res.lignes ?? []);
    setTotalOp(res.total ?? "0");
    setMsgOp(res.message);
  }

  async function recharger(pid: number | "") {
    if (pid === "") {
      setDataBeac(null);
      setFeuilles([]);
      setLignesOp([]);
      setChargement(false);
      return;
    }
    setChargement(true);
    try {
      if (onglet === "beac") {
        await chargerBeac(pid);
      } else {
        await chargerFeuilles(pid);
      }
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Impossible de charger les données.",
      );
    } finally {
      setChargement(false);
    }
  }

  useEffect(() => {
    if (periodeId === "") return;
    void recharger(periodeId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodeId, onglet]);

  function onChangePeriode(idStr: string) {
    const id = idStr === "" ? "" : Number(idStr);
    setPeriodeId(id);
    const p = periodes.find((x) => x.id === id);
    if (p) {
      setDateDebut(isoPremierDuMois(p.exercice_annee, p.mois));
      setDateFin(
        p.date_situation ?? isoPremierDuMois(p.exercice_annee, p.mois),
      );
    }
  }

  async function lancerImport() {
    if (!estChef || periodeId === "") return;
    if (!dateDebut || !dateFin) {
      toast.error("Indiquez la période du 1er du mois à la date de situation.");
      return;
    }
    setImportEnCours(true);
    try {
      if (onglet === "beac") {
        const res = await importerRecapBeac({
          date_debut: dateDebut,
          date_fin: dateFin,
          periode_id: periodeId,
        });
        setDataBeac(res);
        toast.success(
          res.nombre
            ? `Récapitulatif BEAC importé · ${res.nombre} ligne(s).`
            : "Import BEAC terminé (aucune ligne).",
        );
      } else {
        const res = await importerOperationsIgPetrole({
          date_debut: dateDebut,
          date_fin: dateFin,
          periode_id: periodeId,
        });
        const totalLignes = (res.feuilles ?? []).reduce(
          (s, f) => s + f.nb_lignes,
          0,
        );
        toast.success(
          `Opérations F1 importées · ${res.feuilles?.length ?? 0} feuille(s) · ${totalLignes} ligne(s).`,
        );
        await chargerFeuilles(periodeId);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import impossible.");
    } finally {
      setImportEnCours(false);
    }
  }

  async function onChangeFeuille(cle: string) {
    setFeuilleCle(cle);
    const f = feuilles.find((x) => x.cle === cle);
    if (!f || periodeId === "") return;
    setChargement(true);
    try {
      await chargerDetailFeuille(periodeId, f.compte, f.nature);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Chargement impossible.");
    } finally {
      setChargement(false);
    }
  }

  const lignesBeac = dataBeac?.lignes ?? [];

  return (
    <div className="flex flex-col gap-[18px]">
      <SofPageHeader
        title="Comptes pétrole"
        description={
          onglet === "beac"
            ? "Étape 1 · Récapitulatif des encaissements BEAC (format F7)."
            : "Étape 2 · Opérations IG VIDR, une feuille par compte / nature (format F1)."
        }
        remplace="IG › Gestion des guichets › Opérations BEAC / recettes-dépenses"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to="/sof/imports/historique-lots"
              className="inline-flex h-[38px] items-center gap-2 rounded-md border border-[#cbd5e1] bg-white px-3.5 text-[13.5px] font-semibold text-[#0f172a] hover:brightness-95"
            >
              Historique des lots
            </Link>
            <button
              type="button"
              onClick={() => void lancerImport()}
              disabled={!estChef || importEnCours || periodeId === ""}
              title={estChef ? undefined : "Réservé au Chef SOF"}
              className={cn(
                "inline-flex h-[38px] items-center gap-2 rounded-md border px-3.5 text-[13.5px] font-semibold text-white",
                estChef ? "cursor-pointer" : "cursor-not-allowed opacity-50",
              )}
              style={{ background: "#2a7f62", borderColor: "#2a7f62" }}
            >
              {importEnCours ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <RefreshCw size={16} strokeWidth={2.2} />
              )}
              {onglet === "beac" ? "Extraire BEAC (F7)" : "Extraire VIDR (F1)"}
            </button>
          </div>
        }
      />

      <div
        className="flex flex-wrap items-end gap-x-3.5 gap-y-3 rounded-lg border border-[#e2e8f0] bg-white"
        style={{ padding: "12px 14px" }}
      >
        <label className="flex flex-col gap-1 text-[11px] font-semibold tracking-[0.06em] text-[#64748b] uppercase">
          Période SROT
          <select
            value={periodeId === "" ? "" : String(periodeId)}
            onChange={(e) => onChangePeriode(e.target.value)}
            className={cn(champCls, "min-w-[200px]")}
          >
            <option value="">—</option>
            {periodes.map((p) => (
              <option key={p.id} value={p.id}>
                {(p.mois_libelle
                  ? p.mois_libelle.charAt(0).toUpperCase() +
                    p.mois_libelle.slice(1)
                  : String(p.mois)) +
                  " " +
                  p.exercice_annee}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[11px] font-semibold tracking-[0.06em] text-[#64748b] uppercase">
          Du
          <input
            type="date"
            value={dateDebut}
            onChange={(e) => setDateDebut(e.target.value)}
            className={champCls}
          />
        </label>
        <label className="flex flex-col gap-1 text-[11px] font-semibold tracking-[0.06em] text-[#64748b] uppercase">
          Au
          <input
            type="date"
            value={dateFin}
            onChange={(e) => setDateFin(e.target.value)}
            className={champCls}
          />
        </label>
        {periodeSel?.date_situation ? (
          <span className="pb-2 text-[12.5px] text-[#64748b]">
            Situation SROT · {dateFr(periodeSel.date_situation)}
          </span>
        ) : null}
      </div>

      <div
        className="flex gap-1 overflow-x-auto border-b border-[#e2e8f0] px-3"
        style={{ scrollbarWidth: "none" }}
        role="tablist"
      >
        {(
          [
            ["beac", "Étape 1 · Récap BEAC", "F7"],
            ["operations", "Étape 2 · Opérations comptes", "F1"],
          ] as const
        ).map(([k, label, fmt]) => {
          const on = onglet === k;
          return (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setOnglet(k)}
              className="flex h-[46px] shrink-0 items-center gap-2 border-0 bg-transparent px-3 text-[14px] whitespace-nowrap"
              style={{
                fontWeight: on ? 600 : 500,
                color: on ? "#1e6650" : "#64748b",
                boxShadow: on
                  ? "inset 0 -2px 0 #2a7f62"
                  : "inset 0 -2px 0 transparent",
              }}
            >
              {label}
              <span
                className="inline-flex h-[20px] items-center rounded-full px-1.5 text-[11px] font-semibold"
                style={{
                  background: on ? "#e8f5ef" : "#f1f5f9",
                  color: on ? "#1e6650" : "#64748b",
                }}
              >
                {fmt}
              </span>
            </button>
          );
        })}
      </div>

      {onglet === "beac" ? (
        <section className="min-w-0 overflow-hidden rounded-lg border border-[#e2e8f0] bg-white">
          <div
            className="flex flex-wrap items-center justify-between gap-2.5 border-b border-[#e2e8f0]"
            style={{ padding: "12px 16px" }}
          >
            <div className="flex flex-col gap-0.5">
              <span className="text-[15px] font-semibold text-[#0f172a]">
                Récapitulatif BEAC
              </span>
              <span className="text-[12.5px] text-[#64748b]">
                {dataBeac?.lot
                  ? `Lot ${dataBeac.lot.reference} · ${dataBeac.nombre} ligne(s) · F7`
                  : (dataBeac?.message ?? "Aucun lot actif")}
                {dataBeac?.date_debut && dataBeac?.date_fin
                  ? ` · ${dateFr(dataBeac.date_debut)} → ${dateFr(dataBeac.date_fin)}`
                  : ""}
              </span>
            </div>
          </div>

          {chargement ? (
            <div className="flex min-h-[200px] items-center justify-center gap-2 text-[13px] text-[#64748b]">
              <Loader2 size={16} className="animate-spin" />
              Chargement…
            </div>
          ) : (
            <div className="overflow-x-auto">
              <div style={{ minWidth: 640 }}>
                <div
                  className="grid border-b border-[#e2e8f0] bg-[#f8fafc]"
                  style={{ gridTemplateColumns: GRILLE_BEAC }}
                >
                  {(
                    [
                      ["Code", "flex-start"],
                      ["Type de recette", "flex-start"],
                      ["Nature", "flex-start"],
                      ["Montant", "flex-end"],
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
                {lignesBeac.length === 0 ? (
                  <div className="px-4 py-6 text-center text-[13.5px] text-[#64748b]">
                    {dataBeac?.message ?? "Aucune ligne."}
                  </div>
                ) : (
                  lignesBeac.map((l: LigneRecapBeac) => (
                    <div
                      key={l.id}
                      className="grid min-h-[42px] border-b border-[#eef2f4] text-[13px]"
                      style={{
                        gridTemplateColumns: GRILLE_BEAC,
                        background: l.petrole ? "#f0f7f4" : undefined,
                      }}
                    >
                      <div
                        className="flex items-center px-2.5 py-1.5"
                        style={{
                          fontFamily:
                            '"IBM Plex Mono", ui-monospace, monospace',
                          fontWeight: l.petrole ? 600 : 400,
                        }}
                      >
                        {l.code}
                      </div>
                      <div
                        className="flex min-w-0 items-center px-2.5 py-1.5"
                        style={{ fontWeight: l.petrole ? 600 : 400 }}
                      >
                        {l.type_recette}
                      </div>
                      <div className="flex items-center px-2.5 py-1.5">
                        <TagNature petrole={l.petrole} libelle={l.nature} />
                      </div>
                      <div
                        className="flex items-center justify-end px-2.5 py-1.5"
                        style={{
                          fontFamily:
                            '"IBM Plex Mono", ui-monospace, monospace',
                        }}
                      >
                        {formatMontant(l.montant)}
                      </div>
                    </div>
                  ))
                )}
                {lignesBeac.length > 0 ? (
                  <div
                    className="grid min-h-[44px] border-t border-[#e2e8f0] bg-[#f8fafc] text-[13px] font-semibold"
                    style={{ gridTemplateColumns: GRILLE_BEAC }}
                  >
                    <div className="flex items-center px-2.5 py-1.5">
                      Total
                    </div>
                    <div />
                    <div />
                    <div
                      className="flex items-center justify-end px-2.5 py-1.5"
                      style={{
                        fontFamily:
                          '"IBM Plex Mono", ui-monospace, monospace',
                      }}
                    >
                      {formatMontant(dataBeac?.total ?? "0")}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </section>
      ) : (
        <>
          <div
            className="flex flex-wrap items-end gap-x-3.5 gap-y-3 rounded-lg border border-[#e2e8f0] bg-white"
            style={{ padding: "12px 14px" }}
          >
            <label className="flex min-w-[280px] flex-1 flex-col gap-1 text-[11px] font-semibold tracking-[0.06em] text-[#64748b] uppercase">
              Feuille (compte · nature)
              <select
                value={feuilleCle}
                onChange={(e) => void onChangeFeuille(e.target.value)}
                className={champCls}
              >
                {feuilles.map((f) => (
                  <option key={f.cle} value={f.cle}>
                    {f.compte}
                    {f.nature ? ` · nat. ${f.nature}` : ""} — {f.libelle} (
                    {f.nb_lignes})
                  </option>
                ))}
              </select>
            </label>
            {feuilleSel?.lot ? (
              <span className="pb-2 text-[12.5px] text-[#64748b]">
                Lot {feuilleSel.lot.reference} ·{" "}
                {formatMontant(feuilleSel.montant_total)} FCFA
              </span>
            ) : null}
          </div>

          <section className="min-w-0 overflow-hidden rounded-lg border border-[#e2e8f0] bg-white">
            <div
              className="flex flex-wrap items-center justify-between gap-2.5 border-b border-[#e2e8f0]"
              style={{ padding: "12px 16px" }}
            >
              <div className="flex flex-col gap-0.5">
                <span className="text-[15px] font-semibold text-[#0f172a]">
                  {feuilleSel
                    ? `${feuilleSel.libelle} · ${feuilleSel.compte}${feuilleSel.nature ? ` / ${feuilleSel.nature}` : ""}`
                    : "Opérations IG"}
                </span>
                <span className="text-[12.5px] text-[#64748b]">
                  {lignesOp.length} ligne(s) · format F1 / VIDR · table
                  ig_operation
                </span>
              </div>
            </div>

            {chargement ? (
              <div className="flex min-h-[200px] items-center justify-center gap-2 text-[13px] text-[#64748b]">
                <Loader2 size={16} className="animate-spin" />
                Chargement…
              </div>
            ) : (
              <div className="overflow-x-auto">
                <div style={{ minWidth: 900 }}>
                  <div
                    className="grid border-b border-[#e2e8f0] bg-[#f8fafc]"
                    style={{ gridTemplateColumns: GRILLE_OP }}
                  >
                    {(
                      [
                        ["Date", "flex-start"],
                        ["N° regl", "flex-start"],
                        ["Matricule", "flex-start"],
                        ["Compte", "flex-start"],
                        ["Tiers / libellé", "flex-start"],
                        ["Nat.", "flex-start"],
                        ["Mode", "flex-start"],
                        ["Montant", "flex-end"],
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
                  {lignesOp.length === 0 ? (
                    <div className="px-4 py-6 text-center text-[13.5px] text-[#64748b]">
                      {msgOp ?? "Aucune opération."}
                    </div>
                  ) : (
                    lignesOp.map((l) => (
                      <div
                        key={l.id}
                        className="grid min-h-[42px] border-b border-[#eef2f4] text-[13px]"
                        style={{ gridTemplateColumns: GRILLE_OP }}
                      >
                        <div
                          className="flex items-center px-2.5 py-1.5"
                          style={{
                            fontFamily:
                              '"IBM Plex Mono", ui-monospace, monospace',
                          }}
                        >
                          {dateFr(l.d_cpta)}
                        </div>
                        <div
                          className="flex items-center px-2.5 py-1.5"
                          style={{
                            fontFamily:
                              '"IBM Plex Mono", ui-monospace, monospace',
                          }}
                        >
                          {l.n_regl ?? "—"}
                        </div>
                        <div
                          className="flex items-center px-2.5 py-1.5 text-[#475569]"
                          style={{
                            fontFamily:
                              '"IBM Plex Mono", ui-monospace, monospace',
                          }}
                        >
                          {l.n_mattir ?? "—"}
                        </div>
                        <div
                          className="flex items-center px-2.5 py-1.5"
                          style={{
                            fontFamily:
                              '"IBM Plex Mono", ui-monospace, monospace',
                          }}
                        >
                          {l.c_it ?? "—"}
                        </div>
                        <div className="flex min-w-0 items-center px-2.5 py-1.5">
                          <span
                            className="min-w-0 truncate"
                            title={l.l_tiers ?? l.l_np ?? undefined}
                          >
                            {l.l_tiers ?? l.l_np ?? "—"}
                          </span>
                        </div>
                        <div
                          className="flex items-center px-2.5 py-1.5"
                          style={{
                            fontFamily:
                              '"IBM Plex Mono", ui-monospace, monospace',
                          }}
                        >
                          {l.c_nat ?? "—"}
                        </div>
                        <div className="flex items-center px-2.5 py-1.5">
                          <TagNop nop={l.c_nop} />
                        </div>
                        <div
                          className="flex items-center justify-end px-2.5 py-1.5"
                          style={{
                            fontFamily:
                              '"IBM Plex Mono", ui-monospace, monospace',
                          }}
                        >
                          {formatMontant(l.m_regl ?? "0")}
                        </div>
                      </div>
                    ))
                  )}
                  {lignesOp.length > 0 ? (
                    <div
                      className="grid min-h-[44px] border-t border-[#e2e8f0] bg-[#f8fafc] text-[13px] font-semibold"
                      style={{ gridTemplateColumns: GRILLE_OP }}
                    >
                      <div className="flex items-center px-2.5 py-1.5">
                        Total
                      </div>
                      <div />
                      <div />
                      <div />
                      <div />
                      <div />
                      <div />
                      <div
                        className="flex items-center justify-end px-2.5 py-1.5"
                        style={{
                          fontFamily:
                            '"IBM Plex Mono", ui-monospace, monospace',
                        }}
                      >
                        {formatMontant(totalOp)}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
