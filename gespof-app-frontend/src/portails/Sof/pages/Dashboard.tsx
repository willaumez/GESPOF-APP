import {
  useCallback,
  useEffect,
  useState,
  type CSSProperties,
} from "react";
import { Link, useNavigate } from "react-router-dom";
import { Check, ChevronRight, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { SofPageHeader } from "@/portails/Sof/components/layout/SofPageHeader";
import {
  btnPrimaire,
  btnSecondaire,
  CardShell,
  dateFr,
  Kpi,
  SOF_VERT,
} from "@/portails/Sof/components/SofCards";
import {
  basculerPointAttention,
  obtenirPeriodeEnCours,
  ouvrirPeriodeSuivante,
  type EtapeCycleSof,
  type ImportSourceSof,
  type PeriodeEnCoursSof,
  type PointAttentionSof,
  type StatutEtapeCycle,
} from "@/portails/Sof/api/periode-en-cours";
import { usePeriode } from "@/portails/Sof/hooks/PeriodeContext";
import { formatMontant } from "@/shared/lib/format";
import { cn } from "@/shared/lib/utils";

const GRILLE_IMPORTS =
  "minmax(200px, 2fr) 110px 110px 70px 110px 96px";

const ETAPE_STYLE: Record<
  StatutEtapeCycle,
  {
    c: string;
    nfg: string;
    bg: string;
    fg: string;
    row: string;
    hover: string;
    ring: string;
  }
> = {
  termine: {
    c: "#2a7f62",
    nfg: "#fff",
    bg: "#e3f1ea",
    fg: "#1e6650",
    row: "#fff",
    hover: "#f0f7f4",
    ring: "rgba(42, 127, 98, 0.22)",
  },
  en_cours: {
    c: "#b45309",
    nfg: "#fff",
    bg: "#fef3c7",
    fg: "#92400e",
    row: "#fffbeb",
    hover: "#fef3c7",
    ring: "rgba(180, 83, 9, 0.22)",
  },
  a_faire: {
    c: "#cbd5e1",
    nfg: "#475569",
    bg: "#f1f5f9",
    fg: "#475569",
    row: "#fff",
    hover: "#f8fafc",
    ring: "rgba(100, 116, 139, 0.18)",
  },
};

function TagImport({ statut, libelle }: { statut: string; libelle: string }) {
  const style =
    statut === "recu"
      ? { background: "#e3f1ea", color: "#1e6650" }
      : statut === "manquant"
        ? { background: "#fee2e2", color: "#b91c1c" }
        : statut === "annule"
          ? { background: "#f1f5f9", color: "#475569" }
          : statut === "a_valider"
            ? { background: "#fef3c7", color: "#92400e" }
            : { background: "#fef3c7", color: "#92400e" };

  return (
    <span
      className="inline-flex items-center rounded px-2 py-0.5 text-[11.5px] font-semibold whitespace-nowrap"
      style={style}
    >
      {libelle}
    </span>
  );
}

function EtapesCycle({ etapes }: { etapes: EtapeCycleSof[] }) {
  const navigate = useNavigate();
  return (
    <CardShell title="Avancement du cycle" sub="8 étapes de production de la SROT">
      <div
        className="grid"
        style={{
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 128px), 1fr))",
        }}
      >
        {etapes.map((e) => {
          const st = ETAPE_STYLE[e.statut];
          return (
            <button
              key={e.code}
              type="button"
              onClick={() => navigate(e.href)}
              className="group relative flex flex-col gap-2 border-r border-[#f1f5f9] text-left last:border-r-0 transition-[background-color,box-shadow,transform] duration-150 ease-out hover:-translate-y-px active:translate-y-0"
              style={
                {
                  padding: 14,
                  boxShadow: `inset 0 3px 0 ${st.c}`,
                  background: st.row,
                } satisfies CSSProperties
              }
              onMouseEnter={(ev) => {
                ev.currentTarget.style.background = st.hover;
                ev.currentTarget.style.boxShadow = `inset 0 3px 0 ${st.c}, 0 8px 18px -10px ${st.ring}`;
              }}
              onMouseLeave={(ev) => {
                ev.currentTarget.style.background = st.row;
                ev.currentTarget.style.boxShadow = `inset 0 3px 0 ${st.c}`;
              }}
            >
              <span className="flex w-full items-center justify-between gap-2">
                <span
                  className="grid size-6 flex-none place-items-center rounded-full text-[11.5px] font-bold transition-transform duration-150 group-hover:scale-110"
                  style={{ background: st.c, color: st.nfg }}
                >
                  {e.n}
                </span>
                <span
                  className="inline-flex items-center gap-0.5 text-[11px] font-semibold opacity-0 transition-opacity duration-150 group-hover:opacity-100"
                  style={{ color: st.fg }}
                >
                  Ouvrir
                  <ChevronRight size={12} strokeWidth={2.5} />
                </span>
              </span>
              <span
                className="text-[13.5px] leading-[1.3] font-semibold text-[#0f172a] underline-offset-2 group-hover:underline group-hover:decoration-2"
                style={{ textDecorationColor: st.c }}
              >
                {e.libelle}
              </span>
              <span
                className="self-start rounded px-2 py-0.5 text-[11.5px] font-semibold transition-[filter] duration-150 group-hover:brightness-95"
                style={{ background: st.bg, color: st.fg }}
              >
                {e.statut_libelle}
              </span>
            </button>
          );
        })}
      </div>
    </CardShell>
  );
}

function PointsAttention({
  points,
  pied,
  onToggle,
  busy,
}: {
  points: PointAttentionSof[];
  pied: string;
  onToggle: (p: PointAttentionSof) => void;
  busy: string | null;
}) {
  return (
    <CardShell title="Points d'attention" sub="Annexe SROT">
      <div className="flex flex-col">
        {points.map((p) => {
          const on = p.coche;
          return (
            <button
              key={p.code}
              type="button"
              disabled={p.lecture_seule || busy === p.code}
              onClick={() => onToggle(p)}
              className={cn(
                "flex items-center gap-3 border-b text-left transition-colors disabled:cursor-default disabled:opacity-80",
                on
                  ? "border-[#d5e8df] bg-[#f0f7f4] hover:bg-[#e3f1ea]"
                  : "border-[#f1f5f9] bg-white hover:bg-[#f8fafc]",
              )}
              style={{ padding: "10px 16px" }}
            >
              <span
                className="grid size-5 flex-none place-items-center rounded"
                style={{
                  border: `1.5px solid ${on ? SOF_VERT : "#94a3b8"}`,
                  background: on ? SOF_VERT : "#fff",
                  color: "#fff",
                }}
              >
                {on ? <Check size={12} strokeWidth={3} /> : null}
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span
                  className="text-[13.5px] font-medium"
                  style={{ color: on ? "#1e6650" : "#0f172a" }}
                >
                  {p.libelle}
                </span>
                <span
                  className="text-[12.5px]"
                  style={{ color: on ? "#2a7f62" : "#64748b" }}
                >
                  {p.sous_titre}
                </span>
              </span>
            </button>
          );
        })}
        <div
          className="bg-[#f8fafc] text-[12.5px] text-[#64748b]"
          style={{ padding: "10px 16px" }}
        >
          {pied}
        </div>
      </div>
    </CardShell>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { periodeSof, setPeriodeSof, setPeriode } = usePeriode();
  const [data, setData] = useState<PeriodeEnCoursSof | null>(null);
  const [chargement, setChargement] = useState(true);
  const [busyPoint, setBusyPoint] = useState<string | null>(null);
  const [busyOuvrir, setBusyOuvrir] = useState(false);

  const charger = useCallback(async (periodeId?: number) => {
    setChargement(true);
    try {
      const res = await obtenirPeriodeEnCours(periodeId);
      setData(res);
      if (res.periode) {
        setPeriodeSof(res.periode);
        const [y, m, d] = (res.periode.date_situation ?? "").split("-").map(Number);
        const from = new Date(res.periode.exercice_annee, res.periode.mois - 1, 1);
        const to =
          y && m && d
            ? new Date(y, m - 1, d)
            : new Date(res.periode.exercice_annee, res.periode.mois, 0);
        setPeriode({ from, to });
      }
    } catch (e) {
      toast.error(
        e instanceof Error
          ? e.message
          : "Impossible de charger la période en cours.",
      );
    } finally {
      setChargement(false);
    }
  }, [setPeriode, setPeriodeSof]);

  useEffect(() => {
    void charger(periodeSof?.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recharge quand la période topbar change
  }, [periodeSof?.id]);

  async function togglePoint(p: PointAttentionSof) {
    if (!data?.periode?.id || p.lecture_seule) return;
    setBusyPoint(p.code);
    try {
      const res = await basculerPointAttention({
        periode_id: data.periode.id,
        code: p.code,
        coche: !p.coche,
      });
      setData(res);
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Impossible de mettre à jour le point.",
      );
    } finally {
      setBusyPoint(null);
    }
  }

  async function ouvrirSuivante() {
    if (!data?.periode?.id) return;
    setBusyOuvrir(true);
    try {
      const res = await ouvrirPeriodeSuivante(data.periode.id);
      setData(res.synthese);
      setPeriodeSof(res.periode);
      toast.success(
        `${res.periode.mois_libelle ? res.periode.mois_libelle.charAt(0).toUpperCase() + res.periode.mois_libelle.slice(1) : res.periode.mois} ${res.periode.exercice_annee} ouverte.`,
      );
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Impossible d'ouvrir la période suivante.",
      );
    } finally {
      setBusyOuvrir(false);
    }
  }

  const imports = data?.imports ?? [];
  const kpis = data?.kpis ?? [];
  const etapes = data?.etapes ?? [];
  const ecarts = data?.ecarts ?? [];
  const points = data?.points_attention ?? [];
  const synthese = data?.synthese;

  return (
    <div className="flex flex-col gap-[18px]">
      <SofPageHeader
        title="Période en cours"
        description={
          data?.description ??
          "Avancement de la production SROT : exercice, date de situation et statut des imports."
        }
        actions={
          <>
            <button
              type="button"
              className={btnSecondaire}
              disabled={!data?.etape_en_cours_href}
              onClick={() => {
                if (data?.etape_en_cours_href) navigate(data.etape_en_cours_href);
              }}
            >
              Aller à l'étape en cours
              <ChevronRight size={14} strokeWidth={2.5} />
            </button>
            <button
              type="button"
              className={btnPrimaire}
              style={{ background: SOF_VERT }}
              disabled={!data?.peut_ouvrir_suivante || busyOuvrir}
              title={
                data?.peut_ouvrir_suivante
                  ? undefined
                  : "Disponible une fois la période publiée"
              }
              onClick={() => void ouvrirSuivante()}
            >
              {busyOuvrir ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Plus size={14} strokeWidth={2.5} />
              )}
              Ouvrir la période suivante
            </button>
          </>
        }
      />

      {chargement && !data ? (
        <div className="flex min-h-[200px] items-center justify-center gap-2 text-[13px] text-[#64748b]">
          <Loader2 size={16} className="animate-spin" />
          Chargement…
        </div>
      ) : (
        <>
          <div
            className="grid gap-3"
            style={{
              gridTemplateColumns:
                "repeat(auto-fit, minmax(min(100%, 170px), 1fr))",
            }}
          >
            {kpis.map((k) => (
              <Kpi
                key={k.code}
                label={k.label}
                valeur={
                  k.montant ? formatMontant(k.valeur) : k.valeur
                }
                unite={k.unite ?? undefined}
                sous={k.sous}
                accent={k.accent}
                fg={k.fg}
              />
            ))}
          </div>

          {etapes.length > 0 ? <EtapesCycle etapes={etapes} /> : null}

          <div className="grid grid-cols-1 gap-[18px] xl:grid-cols-[minmax(0,1.7fr)_minmax(260px,0.85fr)]">
            <CardShell
              title="Imports de la période"
              sub={data?.imports_sous_titre ?? "—"}
            >
              <div className="overflow-x-auto">
                <div style={{ minWidth: 720 }}>
                  <div
                    className="grid border-b border-[#e2e8f0] bg-[#f8fafc]"
                    style={{ gridTemplateColumns: GRILLE_IMPORTS }}
                  >
                    {(
                      [
                        ["Source", "flex-start"],
                        ["Origine", "flex-start"],
                        ["Dernier import", "flex-start"],
                        ["Lignes", "flex-end"],
                        ["Statut", "flex-start"],
                        ["", "flex-end"],
                      ] as const
                    ).map(([l, jc], i) => (
                      <div
                        key={l || `c-${i}`}
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

                  {imports.length === 0 ? (
                    <div className="px-4 py-6 text-center text-[13.5px] text-[#64748b]">
                      Aucune source d'import configurée.
                    </div>
                  ) : (
                    imports.map((imp: ImportSourceSof) => (
                      <div
                        key={imp.cle ?? imp.format}
                        className={cn(
                          "grid min-h-[42px] border-b border-[#eef2f4] text-[13px]",
                          imp.href && "cursor-pointer hover:bg-[#f8fafc]",
                        )}
                        style={{ gridTemplateColumns: GRILLE_IMPORTS }}
                        onClick={() => {
                          if (imp.href) navigate(imp.href);
                        }}
                        onKeyDown={(e) => {
                          if (imp.href && (e.key === "Enter" || e.key === " ")) {
                            e.preventDefault();
                            navigate(imp.href);
                          }
                        }}
                        role={imp.href ? "link" : undefined}
                        tabIndex={imp.href ? 0 : undefined}
                      >
                        <div className="flex min-w-0 items-center px-2.5 py-1.5 font-medium">
                          <span
                            className="min-w-0"
                            style={{ overflowWrap: "anywhere" }}
                          >
                            {imp.source}
                          </span>
                        </div>
                        <div className="flex items-center px-2.5 py-1.5 text-[#475569]">
                          {imp.origine}
                        </div>
                        <div
                          className="flex items-center px-2.5 py-1.5 text-[#475569]"
                          style={{
                            fontFamily:
                              '"IBM Plex Mono", ui-monospace, monospace',
                          }}
                        >
                          {dateFr(imp.dernier_import)}
                        </div>
                        <div
                          className="flex items-center justify-end px-2.5 py-1.5"
                          style={{
                            fontFamily:
                              '"IBM Plex Mono", ui-monospace, monospace',
                          }}
                        >
                          {imp.nb_lignes != null
                            ? imp.nb_lignes.toLocaleString("fr-FR")
                            : "—"}
                        </div>
                        <div className="flex items-center px-2.5 py-1.5">
                          <TagImport
                            statut={imp.statut}
                            libelle={imp.statut_libelle}
                          />
                        </div>
                        <div
                          className="flex items-center justify-end px-2.5 py-1.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {imp.statut !== "recu" &&
                          imp.statut !== "a_valider" &&
                          imp.href ? (
                            <Link
                              to={imp.href}
                              className="h-7 rounded-[5px] border border-[#bfdccf] bg-[#f0f7f4] px-2.5 text-xs font-semibold leading-7 whitespace-nowrap text-[#1e6650]"
                            >
                              Importer
                            </Link>
                          ) : null}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </CardShell>

            <div className="flex min-w-0 flex-col gap-[18px]">
              <div className="flex flex-col gap-3">
                {ecarts.map((e) => (
                  <Kpi
                    key={e.code}
                    label={e.label}
                    valeur={formatMontant(e.montant)}
                    unite="FCFA"
                    sous={e.sous}
                    accent={e.accent}
                    fg={e.fg}
                    sousColor={e.fg}
                    onClick={() => navigate(e.href)}
                  />
                ))}
              </div>
              <PointsAttention
                points={points}
                pied={data?.points_pied ?? ""}
                onToggle={(p) => void togglePoint(p)}
                busy={busyPoint}
              />
            </div>
          </div>

          {synthese ? (
            <div
              className="grid gap-3"
              style={{
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(min(100%, 190px), 1fr))",
              }}
            >
              {synthese.items.map((s) => (
                <Kpi
                  key={s.code}
                  label={s.label}
                  valeur={
                    s.montant != null ? formatMontant(s.montant) : "—"
                  }
                  unite="FCFA"
                  sous={
                    synthese.disponible
                      ? s.sous
                      : (synthese.message ?? s.sous)
                  }
                  accent={s.accent}
                  fg={s.fg}
                  sousColor={s.accent}
                />
              ))}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
