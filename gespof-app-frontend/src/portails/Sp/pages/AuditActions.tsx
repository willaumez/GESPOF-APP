import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, History, ScrollText, Search, ShieldAlert } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { toast } from "sonner";
import { requeteApi } from "@/shared/lib/api";
import { AUDIT_ACTIONS_ENDPOINT } from "@/shared/api/audit-actions";
import { useAuth } from "@/shared/hooks/use-auth";
import { metiersAssignablesPar } from "@/shared/lib/metiers";
import type {
  AuditAction,
  AuditActionsResponse,
} from "@/shared/types/audit-action.interface";
import {
  PeriodDatePicker,
  periodeVersIso,
} from "@/shared/components/date/PeriodDatePicker";
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
import { DetailAuditAction } from "@/shared/components/audit-action/DetailAuditAction";
import { estCompteConnecte } from "@/shared/components/audit-connexion/affichage";
import { ExporterFormatDialog } from "@/portails/Sr/components/export/ExporterFormatDialog";
import {
  exporterTableau,
  type FormatExportSr,
} from "@/portails/Sr/lib/exporter-tableau";
import { SpPageHeader } from "@/portails/Sp/components/layout/SpPageHeader";
import { SpAuditTabs } from "@/portails/Sp/components/layout/SpAuditTabs";

const TAILLES_PAGE = [20, 50, 100, 200, 500];

const MODULES = [
  { value: "all", label: "Tous les modules" },
  { value: "SP", label: "Service de Prévision" },
  { value: "AUTH", label: "Authentification" },
  { value: "SHARED", label: "Partagé" },
] as const;

export default function AuditActionsPage() {
  const { user, hasAcces } = useAuth();
  const peutConsulter =
    hasAcces("CONSULTER_AUDIT_ACTIONS") ||
    metiersAssignablesPar(user?.roles ?? []).length > 0;

  const [actions, setActions] = useState<AuditAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [detail, setDetail] = useState<AuditAction | null>(null);

  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [periode, setPeriode] = useState<DateRange | undefined>();
  const [moduleFiltre, setModuleFiltre] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState("20");
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const hasActiveFilters = Boolean(
    search || periode?.from || moduleFiltre !== "all",
  );

  useEffect(() => {
    const id = window.setTimeout(() => setSearchDebounced(search.trim()), 350);
    return () => window.clearTimeout(id);
  }, [search]);

  const charger = useCallback(() => {
    if (!peutConsulter) return Promise.resolve();
    setLoading(true);
    setError(false);
    const { dateDebut, dateFin } = periodeVersIso(periode);
    const params = new URLSearchParams({
      page: String(page),
      limit: pageSize,
      portee: "service",
      portail: "sp",
    });
    if (searchDebounced) params.set("search", searchDebounced);
    if (dateDebut) params.set("date_debut", dateDebut);
    if (dateFin) params.set("date_fin", dateFin);

    return requeteApi<AuditActionsResponse>(
      `${AUDIT_ACTIONS_ENDPOINT}?${params}`,
    )
      .then((data) => {
        setActions(data.actions ?? []);
        setTotal(data.pagination?.total ?? 0);
        setTotalPages(data.pagination?.total_pages ?? 1);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [peutConsulter, page, pageSize, searchDebounced, periode]);

  useEffect(() => {
    void charger();
  }, [charger]);

  const actionsFiltrees = useMemo(() => {
    if (moduleFiltre === "all") return actions;
    return actions.filter(
      (a) => (a.module || "").toUpperCase() === moduleFiltre.toUpperCase(),
    );
  }, [actions, moduleFiltre]);

  async function exporterJournal(format: FormatExportSr) {
    setExporting(true);
    try {
      const { dateDebut, dateFin } = periodeVersIso(periode);
      const params = new URLSearchParams({
        page: "1",
        limit: "all",
        portee: "service",
        portail: "sp",
      });
      if (searchDebounced) params.set("search", searchDebounced);
      if (dateDebut) params.set("date_debut", dateDebut);
      if (dateFin) params.set("date_fin", dateFin);

      const data = await requeteApi<AuditActionsResponse>(
        `${AUDIT_ACTIONS_ENDPOINT}?${params}`,
      );
      let lignes = data.actions ?? [];
      if (moduleFiltre !== "all") {
        lignes = lignes.filter(
          (a) =>
            (a.module || "").toUpperCase() === moduleFiltre.toUpperCase(),
        );
      }
      if (lignes.length === 0) {
        toast.message("Aucune action à exporter.");
        return;
      }
      exporterTableau({
        format,
        titre: "Audit d'actions — SP",
        sousTitre: `${lignes.length} action${lignes.length > 1 ? "s" : ""}`,
        colonnes: [
          { cle: "date", libelle: "Date", largeur: 18 },
          { cle: "utilisateur", libelle: "Utilisateur", largeur: 22 },
          { cle: "portail", libelle: "Portail", largeur: 10 },
          { cle: "module", libelle: "Module", largeur: 18 },
          { cle: "action", libelle: "Action", largeur: 32 },
          { cle: "objet", libelle: "Objet", largeur: 28 },
        ],
        lignes: lignes.map((a) => ({
          date: `${a.date_action} ${a.heure_action}`.trim(),
          utilisateur: a.utilisateur.nom_complet,
          portail: a.portail?.valeur?.toUpperCase() ?? "SP",
          module: a.module || a.methode,
          action: a.action,
          objet: a.chemin,
        })),
        nomBase: "audit-actions-sp",
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
              Vous n&apos;avez pas l&apos;autorisation de consulter l&apos;audit
              d&apos;actions du service.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  const GRID_ACT =
    "140px minmax(170px,1fr) 70px 170px minmax(220px,1.4fr) 170px";

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

      <SpAuditTabs active="actions" />

      <div className="flex flex-col overflow-hidden rounded-lg border border-[#e2e8f0] bg-white">
        <div
          className="flex flex-wrap items-center border-b border-[#e2e8f0]"
          style={{ gap: 8, padding: "12px 16px" }}
        >
          <div
            className="flex items-center border border-[#cbd5e1] text-[#64748b]"
            style={{
              height: 36,
              gap: 8,
              padding: "0 12px",
              width: "min(300px, 100%)",
              borderRadius: 6,
            }}
          >
            <Search className="size-4 shrink-0" />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Utilisateur, objet, action…"
              className="h-full min-w-0 flex-1 border-0 bg-transparent text-sm text-[#0f172a] outline-none placeholder:text-[#94a3b8]"
            />
          </div>
          <PeriodDatePicker
            portail="sp"
            variant="filtre"
            libelle="Période"
            value={periode}
            onChange={(range) => {
              setPeriode(range);
              setPage(1);
            }}
          />
          <Select
            value={moduleFiltre}
            onValueChange={(v) => {
              setModuleFiltre(v);
              setPage(1);
            }}
          >
            <SelectTrigger
              className="border border-[#cbd5e1] text-[13.5px] text-[#334155]"
              style={{ height: 36, width: 180, borderRadius: 6 }}
            >
              <SelectValue placeholder="Tous les modules" />
            </SelectTrigger>
            <SelectContent>
              {MODULES.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="overflow-x-auto">
          <div style={{ minWidth: 920 }}>
            <div
              className="grid border-b border-[#e2e8f0] bg-[#f8fafc] text-[11.5px] font-semibold uppercase tracking-[0.06em] text-[#64748b]"
              style={{
                gridTemplateColumns: GRID_ACT,
                gap: 12,
                padding: "9px 16px",
              }}
            >
              <span>Date</span>
              <span>Utilisateur</span>
              <span>Portail</span>
              <span>Module</span>
              <span>Action</span>
              <span>Objet</span>
            </div>

            {loading ? (
              Array.from({ length: 7 }).map((_, i) => (
                <div
                  key={i}
                  className="grid items-center border-b border-[#f1f5f9]"
                  style={{
                    gridTemplateColumns: GRID_ACT,
                    gap: 12,
                    minHeight: 46,
                    padding: "0 16px",
                  }}
                >
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-10" />
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-4 w-28" />
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
            ) : actionsFiltrees.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-4 py-10 text-sm text-[#64748b]">
                <ScrollText className="size-8 text-[#cbd5e1]" />
                {hasActiveFilters
                  ? "Aucune action ne correspond à ces critères."
                  : "Les actions apparaîtront ici dès qu'une opération sera effectuée."}
              </div>
            ) : (
              actionsFiltrees.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setDetail(a)}
                  className="grid w-full items-center border-b border-[#f1f5f9] text-left text-[13.5px] hover:bg-[#f8fafc]"
                  style={{
                    gridTemplateColumns: GRID_ACT,
                    gap: 12,
                    minHeight: 46,
                    padding: "0 16px",
                  }}
                >
                  <span
                    className="text-[12.5px] text-[#475569]"
                    style={{
                      fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
                    }}
                  >
                    {a.date_action} {a.heure_action}
                  </span>
                  <span className="font-medium text-[#0f172a]">
                    {a.utilisateur.nom_complet}
                  </span>
                  <span>{a.portail?.valeur?.toUpperCase() ?? "SP"}</span>
                  <span>
                    <span
                      className="inline-block bg-[#f1f5f9] text-[#334155]"
                      style={{
                        fontSize: 12,
                        padding: "2px 9px",
                        borderRadius: 4,
                      }}
                    >
                      {a.module || a.methode}
                    </span>
                  </span>
                  <span className="min-w-0 truncate text-[#0f172a]">
                    {a.action}
                  </span>
                  <span
                    className="min-w-0 truncate text-[12.5px]"
                    style={{
                      fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
                      color: "#0760A8",
                    }}
                    title={a.chemin}
                  >
                    {a.chemin}
                  </span>
                </button>
              ))
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
                <SelectTrigger className="h-8 w-[80px] border border-[#e2e8f0]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TAILLES_PAGE.map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span>{total} au total</span>
            </div>
            <span className="tabular-nums">
              Page {page} / {totalPages}
            </span>
          </div>
        ) : null}
      </div>

      <DetailAuditAction
        action={detail}
        portail="sp"
        estMoi={
          detail
            ? estCompteConnecte(detail.utilisateur.email, user?.email)
            : false
        }
        onClose={() => setDetail(null)}
      />

      <ExporterFormatDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        titre="Exporter le journal"
        description="Choisissez le format du journal d'actions à télécharger."
        loading={exporting}
        onConfirmer={exporterJournal}
      />
    </>
  );
}
