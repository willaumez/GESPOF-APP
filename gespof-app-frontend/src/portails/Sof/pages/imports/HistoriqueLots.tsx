import { useEffect, useMemo, useState } from "react";
import { Columns2, Eye, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { SofPageHeader } from "@/portails/Sof/components/layout/SofPageHeader";
import {
  annulerLotImport,
  comparerLotsImport,
  listerLotsImport,
  obtenirLotImport,
} from "@/portails/Sof/api/imports";
import { listerPeriodes } from "@/portails/Sof/api/referentiel";
import type {
  AnomalieImportSof,
  LotImportSof,
} from "@/portails/Sof/types/imports.interface";
import type { PeriodeSof } from "@/portails/Sof/types/referentiel.interface";
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

const GRILLE =
  "44px 160px minmax(200px, 1.6fr) 120px 140px 150px 80px 150px 110px 100px";

type LotDetail = LotImportSof & { anomalies?: AnomalieImportSof[] };

function TagStatut({ statut, libelle }: { statut: string; libelle: string }) {
  const style =
    statut === "ACTIF"
      ? { background: "#ecfdf5", color: "#047857" }
      : statut === "REMPLACE" || statut === "ANNULE"
        ? { background: "#f1f5f9", color: "#475569" }
        : { background: "#fef3c7", color: "#92400e" };

  return (
    <span
      className="inline-flex h-[22px] items-center rounded-full px-2 text-[11.5px] font-semibold"
      style={style}
    >
      {libelle}
    </span>
  );
}

function formatDateHeure(iso: string): string {
  // "2026-10-30 09:15:00" → "30/10/2026 09:15"
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]} ${m[4]}:${m[5]}`;
}

export default function HistoriqueLots() {
  const { hasAnyRole } = useAuth();
  const estChef = hasAnyRole(["CHEF_SOF"]);

  const [lots, setLots] = useState<LotImportSof[]>([]);
  const [periodes, setPeriodes] = useState<PeriodeSof[]>([]);
  const [periodeId, setPeriodeId] = useState<number | "toutes">("toutes");
  const [chargement, setChargement] = useState(true);
  const [recherche, setRecherche] = useState("");
  const [selection, setSelection] = useState<Record<number, boolean>>({});
  const [enCours, setEnCours] = useState(false);

  const [annulerLot, setAnnulerLot] = useState<LotImportSof | null>(null);
  const [motifAnnulation, setMotifAnnulation] = useState("");
  const [comparaisonLignes, setComparaisonLignes] = useState<string[] | null>(
    null,
  );
  const [detailLot, setDetailLot] = useState<LotDetail | null>(null);
  const [chargementDetail, setChargementDetail] = useState(false);

  async function ouvrirDetail(lot: LotImportSof) {
    setChargementDetail(true);
    setDetailLot({ ...lot, anomalies: [] });
    try {
      const data = await obtenirLotImport(lot.id);
      setDetailLot(data.lot);
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Impossible de charger le détail.",
      );
      setDetailLot(null);
    } finally {
      setChargementDetail(false);
    }
  }

  async function recharger(periode: number | "toutes" = periodeId) {
    const data = await listerLotsImport(
      periode === "toutes" ? undefined : { periode_id: periode },
    );
    setLots(data.lots ?? []);
  }

  useEffect(() => {
    let actif = true;
    setChargement(true);
    Promise.all([listerPeriodes(), listerLotsImport()])
      .then(([p, l]) => {
        if (!actif) return;
        const periodesListe = p.periodes ?? [];
        setPeriodes(periodesListe);
        setLots(l.lots ?? []);
        // Préférer octobre 2026 si présent
        const oct = periodesListe.find(
          (x) => x.exercice_annee === 2026 && x.mois === 10,
        );
        if (oct) {
          setPeriodeId(oct.id);
          return listerLotsImport({ periode_id: oct.id }).then((r) => {
            if (actif) setLots(r.lots ?? []);
          });
        }
      })
      .catch((e) =>
        toast.error(
          e instanceof Error ? e.message : "Impossible de charger les lots.",
        ),
      )
      .finally(() => {
        if (actif) setChargement(false);
      });
    return () => {
      actif = false;
    };
  }, []);

  useEffect(() => {
    if (chargement) return;
    let actif = true;
    recharger(periodeId)
      .catch((e) =>
        toast.error(
          e instanceof Error ? e.message : "Impossible de filtrer les lots.",
        ),
      )
      .finally(() => {
        if (actif) setSelection({});
      });
    return () => {
      actif = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- filtre volontaire sur periodeId
  }, [periodeId]);

  const filtrees = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    if (!q) return lots;
    return lots.filter(
      (l) =>
        l.reference.toLowerCase().includes(q) ||
        l.source.toLowerCase().includes(q) ||
        l.periode_libelle.toLowerCase().includes(q) ||
        (l.importe_par ?? "").toLowerCase().includes(q) ||
        l.statut_libelle.toLowerCase().includes(q) ||
        (l.fichier_nom ?? "").toLowerCase().includes(q),
    );
  }, [lots, recherche]);

  const idsSelectionnes = useMemo(
    () =>
      Object.entries(selection)
        .filter(([, v]) => v)
        .map(([k]) => Number(k)),
    [selection],
  );

  function basculerSelection(id: number) {
    setSelection((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  async function lancerComparaison() {
    if (idsSelectionnes.length !== 2) {
      toast.error("Sélectionnez exactement deux lots.");
      return;
    }
    setEnCours(true);
    try {
      const { comparaison } = await comparerLotsImport([
        idsSelectionnes[0],
        idsSelectionnes[1],
      ] as [number, number]);
      setComparaisonLignes(comparaison.lignes);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Comparaison impossible.");
    } finally {
      setEnCours(false);
    }
  }

  async function confirmerAnnulation() {
    if (!annulerLot || !estChef) return;
    const motif = motifAnnulation.trim();
    if (!motif) {
      toast.error("Le motif d'annulation est obligatoire.");
      return;
    }
    setEnCours(true);
    try {
      await annulerLotImport(annulerLot.id, motif);
      toast.success("Lot annulé.");
      setAnnulerLot(null);
      setMotifAnnulation("");
      await recharger();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Annulation impossible.");
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className="flex flex-col gap-[18px]">
      <SofPageHeader
        title="Historique des lots"
        description="Cliquez une ligne pour ouvrir le détail du lot. Cochez deux lots d’une même source pour les comparer."
        actions={
          <button
            type="button"
            onClick={() => void lancerComparaison()}
            disabled={idsSelectionnes.length !== 2 || enCours}
            title={
              idsSelectionnes.length === 2
                ? undefined
                : "Sélectionnez deux lots"
            }
            className={cn(
              "inline-flex h-[38px] items-center gap-2 rounded-md border px-3.5 text-[13.5px] font-semibold",
              idsSelectionnes.length === 2
                ? "cursor-pointer border-[#cbd5e1] bg-white text-[#0f172a] hover:brightness-95"
                : "cursor-not-allowed border-[#cbd5e1] bg-white text-[#0f172a] opacity-50",
            )}
          >
            {enCours && idsSelectionnes.length === 2 ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Columns2 size={16} strokeWidth={2.2} />
            )}
            Comparer deux lots
          </button>
        }
      />

      <div
        className="flex flex-wrap items-end gap-x-3.5 gap-y-3 rounded-lg border border-[#e2e8f0] bg-white"
        style={{ padding: "12px 14px" }}
      >
        <label className="flex flex-col gap-1 text-[11px] font-semibold tracking-[0.06em] text-[#64748b] uppercase">
          Période
          <select
            value={periodeId === "toutes" ? "toutes" : String(periodeId)}
            onChange={(e) => {
              const v = e.target.value;
              setPeriodeId(v === "toutes" ? "toutes" : Number(v));
            }}
            className="h-[34px] min-w-[160px] rounded-md border border-[#cbd5e1] bg-white px-2 text-[13px] font-normal tracking-normal text-[#0f172a] normal-case outline-none"
          >
            <option value="toutes">Toutes</option>
            {periodes.map((p) => (
              <option key={p.id} value={p.id}>
                {p.mois_libelle
                  ? `${p.mois_libelle.charAt(0).toUpperCase()}${p.mois_libelle.slice(1)} ${p.exercice_annee}`
                  : `${p.mois}/${p.exercice_annee}`}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-0 flex-1 flex-col gap-1 text-[11px] font-semibold tracking-[0.06em] text-[#64748b] uppercase">
          Recherche
          <span className="flex h-[34px] w-full max-w-[420px] items-center gap-1.5 rounded-md border border-[#cbd5e1] bg-white px-2.5 text-[#64748b]">
            <Search size={14} aria-hidden />
            <input
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              placeholder="Libellé, n°…"
              className="min-w-0 flex-1 border-0 bg-transparent text-[13px] font-normal tracking-normal text-[#0f172a] normal-case outline-none placeholder:text-[#94a3b8]"
            />
          </span>
        </label>
      </div>

      <section className="min-w-0 overflow-hidden rounded-lg border border-[#e2e8f0] bg-white">
        <div
          className="flex flex-wrap items-center justify-between gap-2.5 border-b border-[#e2e8f0]"
          style={{ padding: "12px 16px" }}
        >
          <div className="flex flex-col gap-0.5">
            <span className="text-[15px] font-semibold text-[#0f172a]">Lots</span>
            <span className="text-[12.5px] text-[#64748b]">
              Le plus récent en haut
            </span>
          </div>
        </div>

        {chargement ? (
          <div className="flex min-h-[240px] items-center justify-center gap-2 text-[13px] text-[#64748b]">
            <Loader2 size={16} className="animate-spin" />
            Chargement…
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div style={{ minWidth: 1100 }}>
              <div
                className="grid border-b border-[#e2e8f0] bg-[#f8fafc]"
                style={{ gridTemplateColumns: GRILLE }}
              >
                {(
                  [
                    ["", "center"],
                    ["Lot", "flex-start"],
                    ["Source", "flex-start"],
                    ["Période", "flex-start"],
                    ["Date et heure", "flex-start"],
                    ["Utilisateur", "flex-start"],
                    ["Lignes", "flex-end"],
                    ["Montant total", "flex-end"],
                    ["Statut", "flex-start"],
                    ["", "flex-end"],
                  ] as const
                ).map(([l, jc], i) => (
                  <div
                    key={l || `col-${i}`}
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

              {filtrees.length === 0 ? (
                <div className="px-4 py-6 text-center text-[13.5px] text-[#64748b]">
                  {recherche.trim()
                    ? `Aucune ligne ne correspond à « ${recherche.trim()} ».`
                    : "Aucun lot pour cette période."}
                </div>
              ) : (
                filtrees.map((lot) => {
                  const remplace = lot.statut === "REMPLACE";
                  const fg = remplace ? "#64748b" : undefined;
                  return (
                    <div
                      key={lot.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => void ouvrirDetail(lot)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          void ouvrirDetail(lot);
                        }
                      }}
                      className="grid min-h-[42px] cursor-pointer border-b border-[#eef2f4] text-[13px] transition-colors hover:bg-[#f0fdf6]"
                      style={{ gridTemplateColumns: GRILLE, color: fg }}
                      title="Cliquer pour voir le détail"
                    >
                      <div
                        className="flex items-center justify-center px-2.5 py-1.5"
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={!!selection[lot.id]}
                          onChange={() => basculerSelection(lot.id)}
                          className="size-4 accent-[#2a7f62]"
                          aria-label={`Sélectionner ${lot.reference}`}
                        />
                      </div>
                      <div
                        className="flex items-center px-2.5 py-1.5 font-medium text-[#1e6650]"
                        style={{
                          fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
                        }}
                      >
                        {lot.reference}
                      </div>
                      <div
                        className={cn(
                          "flex min-w-0 items-center px-2.5 py-1.5",
                          !remplace && "font-medium",
                        )}
                      >
                        <span
                          className="min-w-0"
                          style={{ overflowWrap: "anywhere" }}
                        >
                          {lot.source}
                        </span>
                      </div>
                      <div className="flex items-center px-2.5 py-1.5 text-[#475569]">
                        {lot.periode_libelle}
                      </div>
                      <div
                        className="flex items-center px-2.5 py-1.5 text-[#475569]"
                        style={{
                          fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
                        }}
                      >
                        {formatDateHeure(lot.importe_le)}
                      </div>
                      <div className="flex items-center px-2.5 py-1.5 text-[#475569]">
                        {lot.importe_par ?? "—"}
                      </div>
                      <div
                        className="flex items-center justify-end px-2.5 py-1.5"
                        style={{
                          fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
                        }}
                      >
                        {lot.nb_lignes.toLocaleString("fr-FR")}
                      </div>
                      <div
                        className="flex items-center justify-end px-2.5 py-1.5"
                        style={{
                          fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
                        }}
                      >
                        {lot.statut === "REMPLACE"
                          ? "—"
                          : formatMontant(lot.montant_total)}
                      </div>
                      <div className="flex items-center px-2.5 py-1.5">
                        <TagStatut
                          statut={lot.statut}
                          libelle={lot.statut_libelle}
                        />
                      </div>
                      <div
                        className="flex items-center justify-end gap-1.5 px-2.5 py-1.5"
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                      >
                        {lot.peut_annuler ? (
                          <button
                            type="button"
                            disabled={!estChef}
                            title={
                              estChef ? undefined : "Réservé au Chef SOF"
                            }
                            onClick={() => {
                              setMotifAnnulation("");
                              setAnnulerLot(lot);
                            }}
                            className={cn(
                              "h-7 rounded-[5px] border px-2.5 text-xs font-semibold whitespace-nowrap",
                              estChef
                                ? "border-[#bfdccf] bg-[#f0f7f4] text-[#1e6650]"
                                : "cursor-not-allowed border-[#e2e8f0] bg-[#f8fafc] text-[#94a3b8]",
                            )}
                          >
                            Annuler
                          </button>
                        ) : (
                          <span className="inline-flex h-7 items-center gap-1 text-[11.5px] font-medium text-[#94a3b8]">
                            <Eye size={12} strokeWidth={2.2} />
                            Détail
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </section>

      <Dialog
        open={detailLot !== null}
        onOpenChange={(open) => {
          if (!open) setDetailLot(null);
        }}
      >
        <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-[640px]">
          <DialogHeader className="gap-1 border-b border-[#e2e8f0] px-6 py-5 text-left">
            <DialogTitle
              className="text-[19px] font-semibold leading-snug"
              style={{ fontFamily: '"IBM Plex Serif", serif' }}
            >
              Détail du lot {detailLot?.reference ?? ""}
            </DialogTitle>
            <DialogDescription className="text-[13.5px] leading-relaxed text-[#64748b]">
              Métadonnées du lot et anomalies d’import. Les lignes métier
              alimentent les écrans Recettes, Dépenses et SROT.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto px-6 py-[18px]">
            {chargementDetail || !detailLot ? (
              <div className="flex items-center justify-center gap-2 py-10 text-[13px] text-[#64748b]">
                <Loader2 size={16} className="animate-spin" />
                Chargement…
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap items-center gap-2">
                  <TagStatut
                    statut={detailLot.statut}
                    libelle={detailLot.statut_libelle}
                  />
                  <span className="text-[12.5px] text-[#64748b]">
                    {detailLot.format_libelle} · {detailLot.origine}
                  </span>
                </div>
                <dl className="grid grid-cols-1 gap-x-6 gap-y-2.5 sm:grid-cols-2">
                  {(
                    [
                      ["Source", detailLot.source],
                      ["Période", detailLot.periode_libelle],
                      ["Importé le", formatDateHeure(detailLot.importe_le)],
                      ["Par", detailLot.importe_par ?? "—"],
                      [
                        "Lignes",
                        detailLot.nb_lignes.toLocaleString("fr-FR"),
                      ],
                      [
                        "Montant total",
                        formatMontant(detailLot.montant_total),
                      ],
                      ["Fichier", detailLot.fichier_nom ?? "—"],
                      [
                        "Anomalies",
                        String(detailLot.nb_anomalies ?? 0),
                      ],
                    ] as const
                  ).map(([label, value]) => (
                    <div key={label} className="min-w-0">
                      <dt className="text-[11px] font-semibold tracking-[0.05em] text-[#64748b] uppercase">
                        {label}
                      </dt>
                      <dd
                        className="mt-0.5 text-[13.5px] text-[#0f172a]"
                        style={
                          label === "Lignes" ||
                          label === "Montant total" ||
                          label === "Importé le"
                            ? {
                                fontFamily:
                                  '"IBM Plex Mono", ui-monospace, monospace',
                              }
                            : undefined
                        }
                      >
                        {value}
                      </dd>
                    </div>
                  ))}
                </dl>
                {detailLot.parametres &&
                Object.keys(detailLot.parametres).length > 0 ? (
                  <div>
                    <div className="mb-1.5 text-[11px] font-semibold tracking-[0.05em] text-[#64748b] uppercase">
                      Paramètres
                    </div>
                    <pre className="overflow-x-auto rounded-md border border-[#e2e8f0] bg-[#f8fafc] p-3 text-[12px] leading-relaxed text-[#334155]">
                      {JSON.stringify(detailLot.parametres, null, 2)}
                    </pre>
                  </div>
                ) : null}
                <div>
                  <div className="mb-1.5 text-[11px] font-semibold tracking-[0.05em] text-[#64748b] uppercase">
                    Anomalies
                  </div>
                  {(detailLot.anomalies ?? []).length === 0 ? (
                    <p className="m-0 text-[13px] text-[#64748b]">
                      Aucune anomalie enregistrée sur ce lot.
                    </p>
                  ) : (
                    <ul className="flex flex-col gap-1.5">
                      {(detailLot.anomalies ?? []).map((a) => (
                        <li
                          key={a.id ?? `${a.ligne}-${a.colonne}-${a.motif}`}
                          className="rounded-md border border-[#fee2e2] bg-[#fff5f5] px-3 py-2 text-[13px] text-[#7f1d1d]"
                        >
                          Ligne {a.ligne}
                          {a.colonne ? ` · ${a.colonne}` : ""} — {a.motif}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2 border-t border-[#e2e8f0] bg-[#f8fafc] px-6 py-3.5 sm:justify-end">
            <button
              type="button"
              onClick={() => setDetailLot(null)}
              className="inline-flex h-8 items-center rounded-md border border-[#cbd5e1] bg-white px-3 text-[13px] font-semibold text-[#0f172a]"
            >
              Fermer
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={annulerLot !== null}
        onOpenChange={(open) => {
          if (!open && !enCours) {
            setAnnulerLot(null);
            setMotifAnnulation("");
          }
        }}
      >
        <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-[480px]">
          <DialogHeader className="gap-1 border-b border-[#e2e8f0] px-6 py-5 text-left">
            <DialogTitle
              className="text-[19px] font-semibold leading-snug"
              style={{ fontFamily: '"IBM Plex Serif", serif' }}
            >
              Annuler le lot {annulerLot?.reference ?? ""}
            </DialogTitle>
            <DialogDescription className="text-[13.5px] leading-relaxed text-[#64748b]">
              Le lot passera au statut Annulé. Un motif est obligatoire.
            </DialogDescription>
          </DialogHeader>
          <div className="px-6 py-[18px]">
            <label className="flex flex-col gap-1.5">
              <span className="text-[12.5px] font-semibold text-[#334155]">
                Motif
              </span>
              <textarea
                value={motifAnnulation}
                onChange={(e) => setMotifAnnulation(e.target.value)}
                rows={3}
                className="w-full rounded-md border border-[#cbd5e1] bg-white px-2.5 py-2 text-sm text-[#0f172a] outline-none"
                placeholder="Motif de l'annulation…"
              />
            </label>
          </div>
          <DialogFooter className="gap-2 border-t border-[#e2e8f0] bg-[#f8fafc] px-6 py-3.5 sm:justify-end">
            <button
              type="button"
              disabled={enCours}
              onClick={() => {
                setAnnulerLot(null);
                setMotifAnnulation("");
              }}
              className="inline-flex h-8 items-center rounded-md border border-[#cbd5e1] bg-white px-3 text-[13px] font-semibold text-[#0f172a]"
            >
              Fermer
            </button>
            {estChef ? (
              <button
                type="button"
                disabled={enCours}
                onClick={() => void confirmerAnnulation()}
                className="inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-[13px] font-semibold text-white disabled:opacity-50"
                style={{ background: "#2a7f62", borderColor: "#2a7f62" }}
              >
                {enCours ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : null}
                Annuler le lot
              </button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={comparaisonLignes !== null}
        onOpenChange={(open) => {
          if (!open) setComparaisonLignes(null);
        }}
      >
        <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-[480px]">
          <DialogHeader className="gap-1 border-b border-[#e2e8f0] px-6 py-5 text-left">
            <DialogTitle
              className="text-[19px] font-semibold leading-snug"
              style={{ fontFamily: '"IBM Plex Serif", serif' }}
            >
              Comparaison de lots
            </DialogTitle>
            <DialogDescription className="text-[13.5px] leading-relaxed text-[#64748b]">
              Écarts entre les deux lots sélectionnés.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 px-6 py-[18px]">
            {(comparaisonLignes ?? []).map((ligne, i) => (
              <p
                key={i}
                className="m-0 text-[13.5px] leading-relaxed text-[#334155]"
              >
                {ligne}
              </p>
            ))}
          </div>
          <DialogFooter className="gap-2 border-t border-[#e2e8f0] bg-[#f8fafc] px-6 py-3.5 sm:justify-end">
            <button
              type="button"
              onClick={() => setComparaisonLignes(null)}
              className="inline-flex h-8 items-center rounded-md border border-[#cbd5e1] bg-white px-3 text-[13px] font-semibold text-[#0f172a]"
            >
              Fermer
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
