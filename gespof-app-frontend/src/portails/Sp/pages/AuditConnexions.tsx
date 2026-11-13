import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, History, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { requeteApi } from "@/shared/lib/api";
import { PAGINATION } from "@/shared/config/app";
import { AUDIT_CONNEXIONS_ENDPOINT } from "@/shared/api/audit-connexions";
import { optionsTaillePagination } from "@/shared/lib/pagination";
import { useAuth } from "@/shared/hooks/use-auth";
import { getPortalMenu } from "@/shared/config/menu";
import { metiersAssignablesPar } from "@/shared/lib/metiers";
import type {
  AuditConnexionsPointSerie,
  AuditConnexionsResponse,
  SessionConnexion,
} from "@/shared/types/audit-connexion.interface";
import { Skeleton } from "@/shared/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/shared/components/ui/empty";
import { ExporterFormatDialog } from "@/portails/Sr/components/export/ExporterFormatDialog";
import {
  exporterTableau,
  type FormatExportSr,
} from "@/portails/Sr/lib/exporter-tableau";
import { SpPageHeader } from "@/portails/Sp/components/layout/SpPageHeader";
import { SpAuditTabs } from "@/portails/Sp/components/layout/SpAuditTabs";

const theme = getPortalMenu("sp").theme;
const PAGE_SIZE_OPTIONS = optionsTaillePagination();

/** Ex. « Chrome 131 · Windows 11 » — maquette Prototype v2 */
function libelleNavigateur(ua: string | null | undefined): string {
  if (!ua?.trim()) return "—";
  const s = ua;

  let navigateur = "Navigateur";
  const edge = s.match(/Edg\/(\d+)/i);
  const chrome = s.match(/Chrome\/(\d+)/i);
  const firefox = s.match(/Firefox\/(\d+)/i);
  const safari = s.match(/Version\/(\d+).*Safari/i);
  if (edge) navigateur = `Edge ${edge[1]}`;
  else if (chrome && !/Chromium/i.test(s)) navigateur = `Chrome ${chrome[1]}`;
  else if (firefox) navigateur = `Firefox ${firefox[1]}`;
  else if (safari) navigateur = `Safari ${safari[1]}`;

  let os = "—";
  if (/Windows NT 10\.0/i.test(s)) os = "Windows 10/11";
  else if (/Windows NT 6\.1/i.test(s)) os = "Windows 7";
  else if (/Windows/i.test(s)) os = "Windows";
  else if (/Mac OS X 10[._]15/i.test(s) || /Mac OS X 1[1-9]/i.test(s))
    os = "macOS";
  else if (/Mac OS X/i.test(s)) os = "macOS";
  else if (/Android/i.test(s)) os = "Android";
  else if (/iPhone|iPad/i.test(s)) os = "iOS";
  else if (/Linux/i.test(s)) os = "Linux";

  return `${navigateur} · ${os}`;
}

function resultatSession(s: SessionConnexion): {
  label: string;
  bg: string;
  fg: string;
} {
  if (s.statut === "EN_LIGNE") {
    return { label: "Succès", bg: "#ecfdf5", fg: "#047857" };
  }
  const motif = s.motif_deconnexion?.libelle?.toLowerCase() ?? "";
  if (motif.includes("mot de passe") || motif.includes("identifiant")) {
    return { label: "Mot de passe invalide", bg: "#fef2f2", fg: "#b91c1c" };
  }
  if (motif.includes("désactiv")) {
    return { label: "Compte désactivé", bg: "#fef2f2", fg: "#b91c1c" };
  }
  return { label: "Déconnexion", bg: "#f1f5f9", fg: "#475569" };
}

const GRID_COLS =
  "170px minmax(180px,1fr) 80px 120px minmax(180px,1fr) 190px";

export default function AuditConnexionsPage() {
  const { user, hasAcces } = useAuth();
  const peutConsulter =
    hasAcces("CONSULTER_AUDIT_CONNEXIONS") ||
    metiersAssignablesPar(user?.roles ?? []).length > 0;

  const [sessions, setSessions] = useState<SessionConnexion[]>([]);
  const [serie, setSerie] = useState<AuditConnexionsPointSerie[]>([]);
  const [resume, setResume] = useState({
    utilisateurs_connectes: 0,
    sessions_actives: 0,
    connexions_aujourdhui: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [page, setPage] = useState(PAGINATION.PAGE_PAR_DEFAUT);
  const [pageSize, setPageSize] = useState(String(PAGINATION.TAILLE_PAR_DEFAUT));
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const charger = useCallback(() => {
    setLoading(true);
    setError(false);
    const params = new URLSearchParams({
      page: String(page),
      limit: pageSize,
      portail: "sp",
    });

    return requeteApi<AuditConnexionsResponse>(
      `${AUDIT_CONNEXIONS_ENDPOINT}?${params}`,
    )
      .then((data) => {
        setSessions(data.sessions ?? []);
        setSerie(data.serie ?? []);
        setResume(
          data.resume ?? {
            utilisateurs_connectes: 0,
            sessions_actives: 0,
            connexions_aujourdhui: 0,
          },
        );
        setTotal(data.pagination?.total ?? 0);
        setTotalPages(Math.max(1, data.pagination?.total_pages ?? 1));
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [page, pageSize]);

  useEffect(() => {
    if (!peutConsulter) return;
    void charger();
  }, [charger, peutConsulter]);

  const bars = useMemo(() => {
    const pts = serie.slice(-14);
    const max = Math.max(1, ...pts.map((p) => p.connexions));
    return pts.map((p) => {
      const fails = p.deconnexions ?? 0;
      return {
        d: p.date.slice(-2),
        h: Math.round((p.connexions / max) * 150),
        fh:
          fails > 0
            ? Math.max(2, Math.round((fails / max) * 150 * 3))
            : 0,
        tip: `${p.connexions} connexions · ${fails} échecs`,
      };
    });
  }, [serie]);

  const echecsRecents = useMemo(() => {
    const last = serie[serie.length - 1];
    return last?.deconnexions ?? 0;
  }, [serie]);

  /** Libellés KPI — Prototype v2.dc.html */
  const kpis = [
    {
      l: "Connexions (24 h)",
      v: resume.connexions_aujourdhui,
      s: "Sur le Service de Prévision",
    },
    {
      l: "Échecs d'authentification",
      v: echecsRecents,
      s: "Sur la dernière journée",
    },
    {
      l: "Utilisateurs actifs",
      v: resume.utilisateurs_connectes,
      s: "Sessions ouvertes",
    },
    {
      l: "Sessions en cours",
      v: resume.sessions_actives,
      s: "Actives maintenant",
    },
  ];

  async function exporterJournal(format: FormatExportSr) {
    setExporting(true);
    try {
      const data = await requeteApi<AuditConnexionsResponse>(
        `${AUDIT_CONNEXIONS_ENDPOINT}?page=1&limit=all&portail=sp`,
      );
      const lignes = data.sessions ?? [];
      if (lignes.length === 0) {
        toast.message("Aucune session à exporter.");
        return;
      }
      exporterTableau({
        format,
        titre: "Audit des connexions — SP",
        sousTitre: `${lignes.length} session${lignes.length > 1 ? "s" : ""}`,
        colonnes: [
          { cle: "date", libelle: "Date et heure", largeur: 20 },
          { cle: "utilisateur", libelle: "Utilisateur", largeur: 22 },
          { cle: "portail", libelle: "Portail", largeur: 10 },
          { cle: "ip", libelle: "Adresse IP", largeur: 16 },
          { cle: "navigateur", libelle: "Navigateur", largeur: 28 },
          { cle: "resultat", libelle: "Résultat", largeur: 18 },
        ],
        lignes: lignes.map((s) => ({
          date: s.date_connexion,
          utilisateur: s.utilisateur.nom_complet,
          portail: s.portail?.valeur?.toUpperCase() ?? "SP",
          ip: s.adresse_ip ?? "",
          navigateur: libelleNavigateur(s.user_agent),
          resultat: resultatSession(s).label,
        })),
        nomBase: "audit-connexions-sp",
      });
      toast.success("Export généré.");
      setExportOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur lors de l'export.");
    } finally {
      setExporting(false);
    }
  }

  if (!peutConsulter) {
    return (
      <div className="rounded-lg border border-[#e2e8f0] bg-white py-14">
        <Empty>
          <EmptyHeader>
            <EmptyMedia
              variant="icon"
              className="bg-destructive/10 text-destructive"
            >
              <ShieldAlert />
            </EmptyMedia>
            <EmptyTitle>Accès refusé</EmptyTitle>
            <EmptyDescription>
              Vous n&apos;avez pas les droits nécessaires pour consulter
              l&apos;audit des connexions.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  /* Enfants directs du shell (gap 24px) — comme <main> de la maquette v2 */
  return (
    <>
      <SpPageHeader
        eyebrow="SP · Administration · Journal de sécurité"
        title="Audit"
        description="Traçabilité des connexions et des actions réalisées dans GESPOF."
        actions={
          <button
            type="button"
            onClick={() => setExportOpen(true)}
            className="flex h-[38px] items-center gap-2 rounded-md border border-[#cbd5e1] bg-white px-3.5 text-sm font-medium text-[#0f172a] transition-colors hover:border-[#94a3b8] hover:bg-[#f8fafc]"
          >
            <Download size={16} />
            Exporter le journal
          </button>
        }
      />

      <SpAuditTabs active="connexions" />

      <div
        className="overflow-hidden rounded-lg border border-[#e2e8f0] bg-white"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
        }}
      >
        {kpis.map((k) => (
          <div
            key={k.l}
            className="flex flex-col border-r border-[#e2e8f0] last:border-r-0"
            style={{ gap: 6, padding: "18px 20px" }}
          >
            <span className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-[#64748b]">
              {k.l}
            </span>
            <span className="text-[26px] font-semibold tabular-nums text-[#0f172a]">
              {loading ? "—" : k.v}
            </span>
            <span className="text-[13px] text-[#475569]">{k.s}</span>
          </div>
        ))}
      </div>

      <div
        className="rounded-lg border border-[#e2e8f0] bg-white"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 14,
          padding: 18,
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-[15px] font-semibold text-[#0f172a]">
            Connexions — 14 derniers jours
          </span>
          <span className="flex gap-4 text-[12.5px] text-[#475569]">
            <span className="flex items-center gap-1.5">
              <span
                className="inline-block size-2.5 shrink-0"
                style={{ background: theme.topColor }}
              />
              Réussies
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block size-2.5 shrink-0 bg-[#dc2626]" />
              Échecs
            </span>
          </span>
        </div>

        {loading && bars.length === 0 ? (
          <Skeleton className="h-[170px] w-full" />
        ) : bars.length === 0 ? (
          <p className="py-10 text-center text-sm text-[#64748b]">
            Pas encore de série disponible.
          </p>
        ) : (
          <>
            <div
              className="flex items-end border-b border-[#e2e8f0]"
              style={{ height: 170, gap: 8, paddingBottom: 4 }}
            >
              {bars.map((b) => (
                <div
                  key={b.d + b.tip}
                  title={b.tip}
                  className="flex h-full flex-1 flex-col justify-end"
                >
                  <div
                    className="rounded-t-[2px] bg-[#dc2626]"
                    style={{ height: b.fh }}
                  />
                  <div
                    style={{
                      height: b.h,
                      background: theme.topColor,
                      opacity: 0.85,
                    }}
                  />
                </div>
              ))}
            </div>
            <div
              className="flex text-[11.5px] text-[#64748b]"
              style={{ gap: 8 }}
            >
              {bars.map((b) => (
                <span key={`lbl-${b.d}-${b.tip}`} className="flex-1 text-center">
                  {b.d}
                </span>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="flex flex-col overflow-hidden rounded-lg border border-[#e2e8f0] bg-white">
        <div className="overflow-x-auto">
          <div style={{ minWidth: 900 }}>
            <div
              className="grid border-b border-[#e2e8f0] bg-[#f8fafc] text-[11.5px] font-semibold uppercase tracking-[0.06em] text-[#64748b]"
              style={{
                gridTemplateColumns: GRID_COLS,
                gap: 12,
                padding: "9px 16px",
              }}
            >
              <span>Date et heure</span>
              <span>Utilisateur</span>
              <span>Portail</span>
              <span>Adresse IP</span>
              <span>Navigateur</span>
              <span>Résultat</span>
            </div>

            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="grid items-center border-b border-[#f1f5f9]"
                  style={{
                    gridTemplateColumns: GRID_COLS,
                    gap: 12,
                    minHeight: 44,
                    padding: "0 16px",
                  }}
                >
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-4 w-10" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-5 w-20" />
                </div>
              ))
            ) : error ? (
              <div className="px-4 py-10">
                <Empty>
                  <EmptyHeader>
                    <EmptyMedia
                      variant="icon"
                      className="bg-destructive/10 text-destructive"
                    >
                      <History />
                    </EmptyMedia>
                    <EmptyTitle>Erreur de chargement</EmptyTitle>
                    <EmptyDescription>
                      Veuillez rafraîchir la page.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              </div>
            ) : sessions.length === 0 ? (
              <div className="px-4 py-10 text-sm text-[#64748b]">
                Aucune session enregistrée.
              </div>
            ) : (
              sessions.map((s) => {
                const tag = resultatSession(s);
                return (
                  <div
                    key={s.id}
                    className="grid items-center border-b border-[#f1f5f9] text-[13.5px] hover:bg-[#f8fafc]"
                    style={{
                      gridTemplateColumns: GRID_COLS,
                      gap: 12,
                      minHeight: 44,
                      padding: "0 16px",
                    }}
                  >
                    <span
                      className="text-[12.5px] text-[#475569]"
                      style={{
                        fontFamily:
                          '"IBM Plex Mono", ui-monospace, monospace',
                      }}
                    >
                      {s.date_connexion}
                    </span>
                    <span className="font-medium text-[#0f172a]">
                      {s.utilisateur.nom_complet}
                    </span>
                    <span>{s.portail?.valeur?.toUpperCase() ?? "SP"}</span>
                    <span
                      className="text-[12.5px]"
                      style={{
                        fontFamily:
                          '"IBM Plex Mono", ui-monospace, monospace',
                      }}
                    >
                      {s.adresse_ip ?? "—"}
                    </span>
                    <span className="truncate text-[#475569]">
                      {libelleNavigateur(s.user_agent)}
                    </span>
                    <span>
                      <span
                        className="inline-block rounded text-xs font-medium"
                        style={{
                          background: tag.bg,
                          color: tag.fg,
                          padding: "2px 9px",
                          borderRadius: 4,
                          fontSize: 12,
                        }}
                      >
                        {tag.label}
                      </span>
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {!loading && !error && total > 0 && totalPages > 1 ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e2e8f0] px-4 py-3 text-[13px] text-[#64748b]">
            <div className="flex items-center gap-2">
              <span>Lignes par page</span>
              <Select
                value={pageSize}
                onValueChange={(v) => {
                  setPageSize(v);
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-8 w-[76px] border border-[#e2e8f0]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_SIZE_OPTIONS.map(({ value, label }) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <span className="tabular-nums">
              Page {page} / {totalPages}
            </span>
          </div>
        ) : null}
      </div>

      <ExporterFormatDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        titre="Exporter le journal"
        description="Choisissez le format du journal des connexions à télécharger."
        loading={exporting}
        onConfirmer={exporterJournal}
      />
    </>
  );
}
