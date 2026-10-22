import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import type { DateRange } from "react-day-picker";
import {
  ChevronLeft,
  ChevronRight,
  FileDown,
  FileSearch,
  Inbox,
  Loader2,
  MoreVertical,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { requeteApi } from "@/shared/lib/api";
import { PAGINATION } from "@/shared/config/app";
import { SERVICE_REGLEMENT_ENDPOINTS } from "@/portails/Sr/api/endpoints";
import { formatMontant } from "@/shared/lib/format";
import { optionsTaillePagination } from "@/shared/lib/pagination";
import { getPortalMenu } from "@/shared/config/menu";
import { cn } from "@/shared/lib/utils";
import { messageAccesRefuse } from "@/shared/lib/acces";
import { useAuth } from "@/shared/hooks/use-auth";
import {
  PeriodDatePicker,
  periodeVersIso,
} from "@/shared/components/date/PeriodDatePicker";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { Input } from "@/shared/components/ui/input";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Avatar, AvatarFallback } from "@/shared/components/ui/avatar";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
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
import type { Stats, Fiche, FichesDepotResponse } from "@/portails/Sr/types";
import {
  formaterDateHeureFr,
  formaterDateSansHeure,
} from "@/portails/Sr/components/fiche-detail/utils";

type StatutCfg = { badge: string; label: string; row: string };

const STATUT_CFG: Record<string, StatutCfg> = {
  envoyee: {
    badge: "border-transparent bg-emerald-100 text-emerald-800",
    label: "Envoyée",
    row: "border-l-4! border-l-emerald-500! bg-emerald-50/40",
  },
  recue: {
    badge: "border-transparent bg-amber-100 text-amber-900",
    label: "Reçue SP",
    row: "border-l-4! border-l-amber-500! bg-amber-50/40",
  },
  cree: {
    badge: "border-transparent bg-slate-100 text-slate-700",
    label: "Créée",
    row: "border-l-4! border-l-slate-400!",
  },
};

const STATS_CFG: {
  key: keyof Stats;
  label: string;
  hint: string;
}[] = [
  { key: "cree", label: "Créées", hint: "Brouillons locaux" },
  { key: "envoyee", label: "Envoyées", hint: "Transmises au SP" },
  { key: "recue", label: "Reçues SP", hint: "Accusées par le SP" },
  { key: "en_attente", label: "En attente", hint: "Envoyées non lues" },
];

const PAGE_SIZE_OPTIONS = optionsTaillePagination();
const theme = getPortalMenu("sr").theme;

function initiales(nom: string): string {
  return nom
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function urlFichier(f: Fiche): string | null {
  if (!f.reference) return null;
  return `${SERVICE_REGLEMENT_ENDPOINTS.FICHE_DETAIL}/${encodeURIComponent(f.reference)}/telecharger`;
}

export default function ListeFichesDepot() {
  const navigate = useNavigate();
  const { hasAcces } = useAuth();

  const [stats, setStats] = useState<Stats | null>(null);
  const [fiches, setFiches] = useState<Fiche[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filterStatut, setFilterStatut] = useState("");
  const [periode, setPeriode] = useState<DateRange | undefined>();
  const [page, setPage] = useState<number>(PAGINATION.PAGE_PAR_DEFAUT);
  const [pageSize, setPageSize] = useState(String(PAGINATION.TAILLE_PAR_DEFAUT));
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [deleting, setDeleting] = useState<Fiche | null>(null);
  const [deletingLoading, setDeletingLoading] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const chargerFiches = useCallback(() => {
    setLoading(true);
    setError(false);

    const { dateDebut, dateFin } = periodeVersIso(periode);
    const params = new URLSearchParams({
      page: String(page),
      limit: pageSize,
    });
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (filterStatut) params.set("statut", filterStatut);
    if (dateDebut) params.set("date_debut", dateDebut);
    if (dateFin) params.set("date_fin", dateFin);

    return requeteApi<FichesDepotResponse>(
      `${SERVICE_REGLEMENT_ENDPOINTS.FICHES_DEPENSES}?${params.toString()}`,
    )
      .then((data) => {
        setStats(data.stats ?? null);
        setFiches(data.fiches ?? []);
        setTotal(data.pagination?.total ?? 0);
        setTotalPages(Math.max(1, data.pagination?.total_pages ?? 1));
      })
      .catch((e) => {
        setError(true);
        toast.error(
          e instanceof Error ? e.message : "Impossible de charger les fiches.",
        );
      })
      .finally(() => setLoading(false));
  }, [page, pageSize, debouncedSearch, filterStatut, periode]);

  useEffect(() => {
    let actif = true;
    Promise.resolve().then(() => {
      if (actif) void chargerFiches();
    });
    return () => {
      actif = false;
    };
  }, [chargerFiches]);

  async function confirmerSuppression() {
    if (!deleting) return;
    setDeletingLoading(true);
    try {
      await requeteApi<{ ok: boolean }>(
        `${SERVICE_REGLEMENT_ENDPOINTS.FICHE_DETAIL}/${encodeURIComponent(deleting.reference)}`,
        { method: "DELETE" },
      );
      toast.success("Fiche de dépôt supprimée.");
      setDeleting(null);
      void chargerFiches();
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Erreur lors de la suppression.",
      );
    } finally {
      setDeletingLoading(false);
    }
  }

  const hasActiveFilters = Boolean(
    search || filterStatut || periode?.from,
  );

  const resetFilters = () => {
    setSearch("");
    setDebouncedSearch("");
    setFilterStatut("");
    setPeriode(undefined);
    setPage(1);
  };

  const styleHero: CSSProperties = {
    background: `
      radial-gradient(120% 80% at 100% 0%, ${theme.topColor}18 0%, transparent 55%),
      linear-gradient(135deg, ${theme.bgColor} 0%, #ffffff 48%, ${theme.bgColor} 100%)
    `,
    borderColor: `${theme.topColor}33`,
  };

  const stylePanneau: CSSProperties = {
    borderColor: `${theme.topColor}28`,
  };

  return (
    <TooltipProvider>
      <div className="flex w-full flex-col gap-5 pb-2 sm:gap-6">
        {/* Héros */}
        <section
          className="relative overflow-hidden rounded-2xl border-2 px-5 py-5 sm:px-7 sm:py-6"
          style={styleHero}
        >
          <div
            className="pointer-events-none absolute -right-16 -top-20 size-56 rounded-full opacity-40"
            style={{ background: theme.iconBg }}
            aria-hidden
          />
          <div className="relative flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p
                className="text-[11px] font-semibold tracking-[0.14em] uppercase"
                style={{ color: theme.iconColor }}
              >
                Consultation
              </p>
              <h2 className="font-heading text-[1.35rem] font-bold tracking-tight text-[#0f172a] sm:text-[1.55rem]">
                Fiches de dépôt
              </h2>
              <p className="mt-1 max-w-xl text-[13.5px] leading-relaxed text-muted-foreground">
                Recherchez, filtrez par statut ou période de présentation, puis
                ouvrez le détail d&apos;une fiche.
              </p>
            </div>
            <p className="text-[13px] tabular-nums text-muted-foreground">
              {loading
                ? "Chargement…"
                : `${total} fiche${total !== 1 ? "s" : ""}`}
            </p>
          </div>
        </section>

        {/* Stats */}
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {STATS_CFG.map(({ key, label, hint }) => (
            <div
              key={key}
              className="rounded-2xl border-2 bg-card px-4 py-3.5"
              style={stylePanneau}
            >
              <p className="text-[11.5px] font-medium text-muted-foreground">
                {label}
              </p>
              {loading ? (
                <Skeleton className="mt-2 h-7 w-12" />
              ) : error ? (
                <p className="mt-1 font-heading text-xl font-bold text-muted-foreground/40">
                  —
                </p>
              ) : (
                <p className="mt-1 font-heading text-2xl font-bold tabular-nums text-[#0f172a]">
                  {stats?.[key] ?? 0}
                </p>
              )}
              <p className="mt-0.5 text-[11.5px] text-muted-foreground/80">
                {hint}
              </p>
            </div>
          ))}
        </section>

        {/* Liste */}
        <section
          className="overflow-hidden rounded-2xl border-2 bg-card"
          style={stylePanneau}
        >
          <div
            className="flex flex-col gap-3 border-b px-4 py-4 sm:px-5"
            style={{ borderColor: `${theme.topColor}18` }}
          >
            <div className="flex w-full flex-wrap items-center gap-2">
              <div className="relative min-w-[12rem] flex-1 sm:max-w-xs">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Référence, agent…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-9 border-2 bg-white pl-8"
                  style={{ borderColor: `${theme.topColor}28` }}
                />
              </div>

              <Select
                value={filterStatut || "all"}
                onValueChange={(v) => {
                  setFilterStatut(v === "all" ? "" : v);
                  setPage(1);
                }}
              >
                <SelectTrigger
                  className="h-9 w-[150px] border-2 bg-white"
                  style={{ borderColor: `${theme.topColor}28` }}
                >
                  <SelectValue placeholder="Tous les statuts" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  <SelectItem value="cree">Créée</SelectItem>
                  <SelectItem value="envoyee">Envoyée</SelectItem>
                  <SelectItem value="recue">Reçue SP</SelectItem>
                </SelectContent>
              </Select>

              {hasActiveFilters ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-9 w-9 border-2"
                      style={{ borderColor: `${theme.topColor}28` }}
                      onClick={resetFilters}
                    >
                      <X className="size-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Réinitialiser les filtres</TooltipContent>
                </Tooltip>
              ) : null}

              <PeriodDatePicker
                portail="sr"
                variant="filtre"
                libelle="Période"
                className="ml-auto"
                value={periode}
                onChange={(range) => {
                  setPeriode(range);
                  setPage(1);
                }}
              />
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow
                className="hover:bg-transparent"
                style={{ background: theme.bgColor }}
              >
                <TableHead className="h-11 text-[11px] font-bold uppercase tracking-wider text-[#0f172a]/70">
                  Référence
                </TableHead>
                <TableHead className="h-11 text-[11px] font-bold uppercase tracking-wider text-[#0f172a]/70">
                  Présentation
                </TableHead>
                <TableHead className="h-11 text-[11px] font-bold uppercase tracking-wider text-[#0f172a]/70">
                  Création
                </TableHead>
                <TableHead className="h-11 text-[11px] font-bold uppercase tracking-wider text-[#0f172a]/70">
                  Montant
                </TableHead>
                <TableHead className="h-11 text-[11px] font-bold uppercase tracking-wider text-[#0f172a]/70">
                  Généré par
                </TableHead>
                <TableHead className="h-11 text-[11px] font-bold uppercase tracking-wider text-[#0f172a]/70">
                  Statut
                </TableHead>
                <TableHead className="h-11 text-right text-[11px] font-bold uppercase tracking-wider text-[#0f172a]/70">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, idx) => (
                  <TableRow key={idx}>
                    <TableCell>
                      <Skeleton className="h-4 w-36" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-28" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-28" />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Skeleton className="size-6 rounded-full" />
                        <Skeleton className="h-4 w-20" />
                      </div>
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-5 w-20 rounded-full" />
                    </TableCell>
                    <TableCell />
                  </TableRow>
                ))
              ) : error ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={7} className="py-12">
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
                          Vérifiez votre connexion puis rafraîchissez la page.
                        </EmptyDescription>
                      </EmptyHeader>
                    </Empty>
                  </TableCell>
                </TableRow>
              ) : fiches.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={7} className="py-12">
                    <Empty>
                      <EmptyHeader>
                        <EmptyMedia variant="icon">
                          <Inbox />
                        </EmptyMedia>
                        <EmptyTitle>Aucune fiche trouvée</EmptyTitle>
                        <EmptyDescription>
                          {hasActiveFilters
                            ? "Modifiez ou réinitialisez vos filtres de recherche."
                            : "Les fiches générées apparaîtront ici."}
                        </EmptyDescription>
                      </EmptyHeader>
                    </Empty>
                  </TableCell>
                </TableRow>
              ) : (
                fiches.map((f) => {
                  const st = STATUT_CFG[f.statut] ?? STATUT_CFG.cree;
                  const fichier = urlFichier(f);
                  return (
                    <TableRow
                      key={f.reference}
                      className={cn("cursor-pointer", st.row)}
                      onClick={() =>
                        navigate(
                          `/sr/fiche/${encodeURIComponent(f.reference)}`,
                        )
                      }
                    >
                      <TableCell
                        className="font-mono text-[13px] font-semibold"
                        style={{ color: theme.iconColor }}
                      >
                        {f.reference}
                      </TableCell>
                      <TableCell className="tabular-nums text-muted-foreground">
                        {formaterDateSansHeure(
                          f.datePresentation ??
                            f.date_presentation_libelle ??
                            f.date_presentation,
                        )}
                      </TableCell>
                      <TableCell className="tabular-nums text-muted-foreground">
                        {formaterDateHeureFr(f.date_creation)}
                      </TableCell>
                      <TableCell>
                        <span className="font-semibold tabular-nums text-[#0f172a]">
                          {formatMontant(f.montant_total)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar size="sm">
                            <AvatarFallback
                              className="text-[10px] font-bold text-white"
                              style={{ background: theme.ctaColor }}
                            >
                              {initiales(f.genere_par)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-muted-foreground">
                            {f.genere_par}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={st.badge}>{st.label}</Badge>
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
                                className="size-8"
                                aria-label={`Actions pour ${f.reference}`}
                              >
                                <MoreVertical className="size-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-52">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              <DropdownMenuItem
                                onSelect={() =>
                                  navigate(
                                    `/sr/fiche/${encodeURIComponent(f.reference)}`,
                                  )
                                }
                              >
                                <FileSearch
                                  className="size-4"
                                  style={{ color: theme.iconColor }}
                                />
                                Voir le détail
                              </DropdownMenuItem>
                              {fichier ? (
                                <DropdownMenuItem asChild>
                                  <a
                                    href={fichier}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    <FileDown className="size-4 text-emerald-600" />
                                    Télécharger le fichier
                                  </a>
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem disabled>
                                  <FileDown className="size-4 text-muted-foreground/40" />
                                  Fichier indisponible
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                variant="destructive"
                                disabled={
                                  f.statut === "envoyee" || f.statut === "recue"
                                }
                                className={
                                  !hasAcces("SUPPRIMER_FICHE_DEPOT")
                                    ? "opacity-40 grayscale-[35%]"
                                    : undefined
                                }
                                onSelect={() => {
                                  if (!hasAcces("SUPPRIMER_FICHE_DEPOT")) {
                                    toast.error(
                                      messageAccesRefuse("SUPPRIMER_FICHE_DEPOT"),
                                    );
                                    return;
                                  }
                                  if (
                                    f.statut === "envoyee" ||
                                    f.statut === "recue"
                                  ) {
                                    return;
                                  }
                                  setDeleting(f);
                                }}
                              >
                                <Trash2 className="size-4" />
                                {f.statut === "envoyee" || f.statut === "recue"
                                  ? "Suppression impossible"
                                  : "Supprimer"}
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

          {!loading && !error && total > 0 ? (
            <div
              className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3"
              style={{ borderColor: `${theme.topColor}18` }}
            >
              <div className="flex items-center gap-2">
                <p className="text-xs text-muted-foreground">Lignes par page</p>
                <Select
                  value={pageSize}
                  onValueChange={(v) => {
                    setPageSize(v);
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="h-8 w-[76px]">
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
                  <p className="text-xs tabular-nums text-muted-foreground">
                    Page {page} / {totalPages}
                  </p>
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
                Supprimer cette fiche de dépôt ?
              </AlertDialogTitle>
              <AlertDialogDescription>
                Cette action est définitive. Les mouvements, l&apos;historique
                et le fichier Excel de la fiche{" "}
                <span className="font-mono font-semibold">
                  {deleting?.reference}
                </span>{" "}
                seront supprimés.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deletingLoading}>
                Annuler
              </AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={() => void confirmerSuppression()}
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
      </div>
    </TooltipProvider>
  );
}
