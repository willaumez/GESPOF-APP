import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Trash2,
  Loader2,
  Inbox,
  ShieldAlert,
  X,
  FileSearch,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
  Download,
} from "lucide-react";
import { toast } from "sonner";
import type { DateRange } from "react-day-picker";
import { requeteApi } from "@/shared/lib/api";
import { PAGINATION } from "@/shared/config/app";
import { SERVICE_REGLEMENT_ENDPOINTS } from "@/portails/Sr/api/endpoints";
import { UTILISATEURS_ENDPOINT } from "@/shared/api/utilisateurs";
import { optionsTaillePagination } from "@/shared/lib/pagination";
import { useAuth } from "@/shared/hooks/use-auth";
import { messageAccesRefuse } from "@/shared/lib/acces";
import { getPortalMenu } from "@/shared/config/menu";
import { cn } from "@/shared/lib/utils";
import type { HistoriqueEntree, HistoriqueResponse } from "@/portails/Sr/types";
import type { UtilisateursResponse } from "@/shared/types/utilisateur.interface";
import {
  PeriodDatePicker,
  periodeVersIso,
} from "@/shared/components/date/PeriodDatePicker";
import { formaterDateHeureFr } from "@/portails/Sr/components/fiche-detail/utils";
import { Skeleton } from "@/shared/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogMedia,
} from "@/shared/components/ui/alert-dialog";
import { Button } from "@/shared/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { Badge } from "@/shared/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/shared/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/shared/components/ui/tooltip";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/shared/components/ui/empty";
import { SrPageHeader } from "@/portails/Sr/components/layout/SrPageHeader";
import { ExporterFormatDialog } from "@/portails/Sr/components/export/ExporterFormatDialog";
import {
  COLONNES_HISTORIQUE,
  exporterTableau,
  type FormatExportSr,
} from "@/portails/Sr/lib/exporter-tableau";

const theme = getPortalMenu("sr").theme;

const STATUT_TAG: Record<string, { bg: string; fg: string; label: string }> = {
  cree: { bg: "#f1f5f9", fg: "#475569", label: "Créée" },
  envoyee: { bg: "#ecfdf5", fg: "#047857", label: "Envoyée" },
  recue: { bg: "#fffbeb", fg: "#b45309", label: "Reçue SP" },
};

const ACTION_LABEL: Record<string, string> = {
  CREATION: "Création",
  CHANGEMENT_STATUT: "Changement de statut",
};

const PAGE_SIZE_OPTIONS = optionsTaillePagination();

export default function Historique() {
  const navigate = useNavigate();
  const { hasRole, hasAcces } = useAuth();
  const peutConsulter = hasRole("AGENT_SR");

  const [historique, setHistorique] = useState<HistoriqueEntree[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [periode, setPeriode] = useState<DateRange | undefined>();
  const [filterUtilisateur, setFilterUtilisateur] = useState("all");
  const [page, setPage] = useState<number>(PAGINATION.PAGE_PAR_DEFAUT);
  const [pageSize, setPageSize] = useState(String(PAGINATION.TAILLE_PAR_DEFAUT));
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [utilisateurs, setUtilisateurs] = useState<{ id: number; label: string }[]>(
    [],
  );
  const [deleting, setDeleting] = useState<HistoriqueEntree | null>(null);
  const [deletingLoading, setDeletingLoading] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!peutConsulter) return;
    requeteApi<UtilisateursResponse>(`${UTILISATEURS_ENDPOINT}?limit=all`)
      .then((data) => {
        setUtilisateurs(
          (data.utilisateurs ?? []).map((u) => ({
            id: u.id,
            label: `${u.nom} ${u.prenom}`,
          })),
        );
      })
      .catch(() => {});
  }, [peutConsulter]);

  const chargerHistorique = useCallback(() => {
    setLoading(true);
    setError(false);
    const { dateDebut, dateFin } = periodeVersIso(periode);
    const params = new URLSearchParams({
      page: String(page),
      limit: pageSize,
    });
    if (dateDebut) params.set("date_debut", dateDebut);
    if (dateFin) params.set("date_fin", dateFin);
    if (filterUtilisateur !== "all")
      params.set("utilisateur_id", filterUtilisateur);
    return requeteApi<HistoriqueResponse>(
      `${SERVICE_REGLEMENT_ENDPOINTS.HISTORIQUE}?${params.toString()}`,
    )
      .then((data) => {
        setHistorique(data.historique ?? []);
        setTotal(data.pagination?.total ?? 0);
        setTotalPages(Math.max(1, data.pagination?.total_pages ?? 1));
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [periode, filterUtilisateur, page, pageSize]);

  useEffect(() => {
    if (!peutConsulter) return;
    Promise.resolve().then(() => chargerHistorique());
  }, [chargerHistorique, peutConsulter]);

  const hasActiveFilters = Boolean(periode?.from || filterUtilisateur !== "all");
  const resetFiltres = () => {
    setPeriode(undefined);
    setFilterUtilisateur("all");
    setPage(1);
  };

  async function confirmerSuppression() {
    if (!deleting) return;
    setDeletingLoading(true);
    try {
      await requeteApi<{ ok: boolean }>(
        `${SERVICE_REGLEMENT_ENDPOINTS.HISTORIQUE}/${deleting.id}`,
        { method: "DELETE" },
      );
      toast.success("Entrée d'historique supprimée.");
      setDeleting(null);
      chargerHistorique();
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Erreur lors de la suppression.",
      );
    } finally {
      setDeletingLoading(false);
    }
  }

  async function exporterHistorique(format: FormatExportSr) {
    setExporting(true);
    try {
      const { dateDebut, dateFin } = periodeVersIso(periode);
      const params = new URLSearchParams({ page: "1", limit: "all" });
      if (dateDebut) params.set("date_debut", dateDebut);
      if (dateFin) params.set("date_fin", dateFin);
      if (filterUtilisateur !== "all")
        params.set("utilisateur_id", filterUtilisateur);

      const data = await requeteApi<HistoriqueResponse>(
        `${SERVICE_REGLEMENT_ENDPOINTS.HISTORIQUE}?${params.toString()}`,
      );
      const entrees = data.historique ?? [];
      if (entrees.length === 0) {
        toast.message("Aucun événement à exporter.");
        return;
      }

      exporterTableau({
        format,
        titre: "Historique — fiches de dépôt",
        sousTitre: `Pool SR · ${entrees.length} événement${entrees.length > 1 ? "s" : ""}`,
        colonnes: COLONNES_HISTORIQUE,
        lignes: entrees.map((e) => ({
          date: e.date_action,
          fiche: e.fiche_reference ?? "",
          action: ACTION_LABEL[e.action] ?? e.action,
          statut: e.nouveau_statut
            ? (STATUT_TAG[e.nouveau_statut]?.label ?? e.nouveau_statut)
            : "",
          utilisateur: e.utilisateur.nom_complet,
          matricule: e.utilisateur.matricule,
          commentaire: e.commentaire ?? "",
        })),
        nomBase: "historique-sr",
      });
      toast.success("Export généré.");
      setExportOpen(false);
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Erreur lors de l'export.",
      );
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
              l&apos;historique des fiches de dépôt.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="flex flex-col gap-6">
        <SrPageHeader
          eyebrow="Pool SR · Consultation"
          title="Historique"
          description="Journal des actions réalisées sur les fiches de dépôt."
          actions={
            <button
              type="button"
              onClick={() => setExportOpen(true)}
              className="flex h-[38px] items-center gap-2 rounded-md border border-[#cbd5e1] bg-white px-3.5 text-sm font-medium text-[#0f172a] transition-colors hover:border-[#94a3b8] hover:bg-[#f8fafc]"
            >
              <Download size={16} />
              Exporter
            </button>
          }
        />

        <ExporterFormatDialog
          open={exportOpen}
          onOpenChange={setExportOpen}
          titre="Exporter l'historique"
          description="Choisissez le format du journal des actions à télécharger."
          loading={exporting}
          onConfirmer={exporterHistorique}
        />

        <section className="flex flex-col rounded-lg border border-[#e2e8f0] bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e2e8f0] px-4 py-3">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
              <Select
                value={filterUtilisateur}
                onValueChange={(v) => {
                  setFilterUtilisateur(v);
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-9 w-[200px] border border-[#cbd5e1] bg-white">
                  <SelectValue placeholder="Tous les utilisateurs" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les utilisateurs</SelectItem>
                  {utilisateurs.map((u) => (
                    <SelectItem key={u.id} value={String(u.id)}>
                      {u.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <PeriodDatePicker
                portail="sr"
                variant="filtre"
                libelle="Période"
                value={periode}
                onChange={(range) => {
                  setPeriode(range);
                  setPage(1);
                }}
              />

              {hasActiveFilters ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-9 w-9 border border-[#cbd5e1]"
                      onClick={resetFiltres}
                    >
                      <X className="size-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Réinitialiser les filtres</TooltipContent>
                </Tooltip>
              ) : null}
            </div>
            <span className="text-[13px] text-[#64748b]">
              {loading
                ? "Chargement…"
                : `${total} événement${total !== 1 ? "s" : ""}`}
            </span>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-b border-[#e2e8f0] bg-[#f8fafc]">
                  <TableHead className="h-10 px-[18px] text-[11.5px] font-semibold uppercase tracking-[0.06em] text-[#64748b]">
                    Date
                  </TableHead>
                  <TableHead className="h-10 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-[#64748b]">
                    Fiche
                  </TableHead>
                  <TableHead className="h-10 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-[#64748b]">
                    Action
                  </TableHead>
                  <TableHead className="h-10 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-[#64748b]">
                    Statut
                  </TableHead>
                  <TableHead className="h-10 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-[#64748b]">
                    Utilisateur
                  </TableHead>
                  <TableHead className="h-10 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-[#64748b]">
                    Commentaire
                  </TableHead>
                  <TableHead className="h-10 w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 6 }).map((_, idx) => (
                    <TableRow key={idx}>
                      <TableCell>
                        <Skeleton className="h-4 w-32" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-24" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-32" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-5 w-24 rounded-full" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-28" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-36" />
                      </TableCell>
                      <TableCell />
                    </TableRow>
                  ))
                ) : error ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-10">
                      <Empty>
                        <EmptyHeader>
                          <EmptyMedia
                            variant="icon"
                            className="bg-destructive/10 text-destructive"
                          >
                            <Inbox />
                          </EmptyMedia>
                          <EmptyTitle>Erreur de chargement</EmptyTitle>
                          <EmptyDescription>
                            Veuillez rafraîchir la page.
                          </EmptyDescription>
                        </EmptyHeader>
                      </Empty>
                    </TableCell>
                  </TableRow>
                ) : historique.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-10">
                      <Empty>
                        <EmptyHeader>
                          <EmptyMedia variant="icon">
                            <Inbox />
                          </EmptyMedia>
                          <EmptyTitle>Aucune entrée trouvée</EmptyTitle>
                          <EmptyDescription>
                            Essayez de modifier vos filtres.
                          </EmptyDescription>
                        </EmptyHeader>
                      </Empty>
                    </TableCell>
                  </TableRow>
                ) : (
                  historique.map((h) => {
                    const statutCible = h.nouveau_statut ?? h.ancien_statut;
                    const tag = statutCible
                      ? (STATUT_TAG[statutCible] ?? {
                          bg: "#f1f5f9",
                          fg: "#475569",
                          label: statutCible,
                        })
                      : null;
                    return (
                      <TableRow
                        key={h.id}
                        className={cn(
                          "border-b border-[#f1f5f9] text-[13.5px] hover:bg-[#f8fafc]",
                          h.fiche_reference && "cursor-pointer",
                        )}
                        onClick={() =>
                          h.fiche_reference &&
                          navigate(
                            `/sr/fiche/${encodeURIComponent(h.fiche_reference)}`,
                          )
                        }
                      >
                        <TableCell className="whitespace-nowrap px-[18px] font-mono text-[12.5px] tabular-nums text-[#475569]">
                          {formaterDateHeureFr(h.date_action)}
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          {h.fiche_reference ? (
                            <button
                              type="button"
                              onClick={() =>
                                navigate(
                                  `/sr/fiche/${encodeURIComponent(h.fiche_reference!)}`,
                                )
                              }
                              className="font-mono text-[13px] font-medium hover:underline"
                              style={{
                                fontFamily:
                                  '"IBM Plex Mono", ui-monospace, monospace',
                                color: theme.textColor,
                              }}
                            >
                              {h.fiche_reference}
                            </button>
                          ) : (
                            <span className="text-[#94a3b8]">—</span>
                          )}
                        </TableCell>
                        <TableCell className="font-semibold text-[#0f172a]">
                          {ACTION_LABEL[h.action] ?? h.action}
                        </TableCell>
                        <TableCell>
                          {tag ? (
                            <Badge
                              className="rounded px-2.5 py-0.5 text-xs font-medium border-transparent"
                              style={{ background: tag.bg, color: tag.fg }}
                            >
                              {tag.label}
                            </Badge>
                          ) : (
                            <span className="text-[#94a3b8]">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-[#0f172a]">
                          {h.utilisateur.nom_complet}
                        </TableCell>
                        <TableCell
                          className={cn(
                            "max-w-[240px] truncate",
                            h.commentaire
                              ? "text-[#475569]"
                              : "text-[#94a3b8]",
                          )}
                          title={h.commentaire ?? undefined}
                        >
                          {h.commentaire ?? "—"}
                        </TableCell>
                        <TableCell
                          className="text-right"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex justify-end">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="size-[30px] text-[#64748b] hover:bg-[#f1f5f9]"
                                  aria-label="Actions"
                                >
                                  <MoreVertical className="size-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                {h.fiche_reference ? (
                                  <DropdownMenuItem
                                    onSelect={() =>
                                      navigate(
                                        `/sr/fiche/${encodeURIComponent(h.fiche_reference!)}`,
                                      )
                                    }
                                  >
                                    <FileSearch
                                      className="size-4"
                                      style={{ color: theme.iconColor }}
                                    />
                                    Voir la fiche
                                  </DropdownMenuItem>
                                ) : null}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  variant="destructive"
                                  className={
                                    !hasAcces("SUPPRIMER_HISTORIQUE")
                                      ? "opacity-40 grayscale-[35%]"
                                      : undefined
                                  }
                                  onSelect={() => {
                                    if (!hasAcces("SUPPRIMER_HISTORIQUE")) {
                                      toast.error(
                                        messageAccesRefuse(
                                          "SUPPRIMER_HISTORIQUE",
                                        ),
                                      );
                                      return;
                                    }
                                    setDeleting(h);
                                  }}
                                >
                                  <Trash2 className="size-4" />
                                  Supprimer
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {!loading && !error && total > 0 ? (
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

              {totalPages > 1 ? (
                <div className="flex items-center gap-3">
                  <span className="tabular-nums">
                    Page {page} / {totalPages}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={page === 1}
                      onClick={() => setPage((p) => p - 1)}
                    >
                      <ChevronLeft className="size-4" />
                    </Button>
                    {Array.from({ length: Math.min(totalPages, 7) }).map(
                      (_, i) => {
                        const pageNum =
                          totalPages <= 7
                            ? i + 1
                            : Math.min(
                                Math.max(1, page - 3) + i,
                                totalPages - (6 - i),
                              );
                        return (
                          <Button
                            key={pageNum}
                            variant={page === pageNum ? "default" : "ghost"}
                            size="icon"
                            className={
                              page === pageNum ? "text-white" : undefined
                            }
                            style={
                              page === pageNum
                                ? { background: theme.ctaColor }
                                : undefined
                            }
                            onClick={() => setPage(pageNum)}
                          >
                            {pageNum}
                          </Button>
                        );
                      },
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={page === totalPages}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      <ChevronRight className="size-4" />
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </section>
      </div>

      <AlertDialog
        open={!!deleting}
        onOpenChange={(o) => {
          if (!o) setDeleting(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-destructive/10 text-destructive">
              <Trash2 />
            </AlertDialogMedia>
            <AlertDialogTitle>
              Supprimer cette entrée d&apos;historique ?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est définitive et ne peut pas être annulée.
              {deleting?.fiche_reference ? (
                <>
                  {" "}
                  L&apos;entrée concerne la fiche{" "}
                  <span className="font-mono font-semibold">
                    {deleting.fiche_reference}
                  </span>
                  .
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingLoading}>
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={confirmerSuppression}
              disabled={deletingLoading}
            >
              {deletingLoading ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : null}
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TooltipProvider>
  );
}
