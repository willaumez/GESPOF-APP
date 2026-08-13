import { useCallback, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FileSearch, FileDown, Search, ChevronLeft, ChevronRight, Trash2, Loader2, X, Clock, Inbox } from "lucide-react";
import { toast } from "sonner";
import { requeteApi } from "@/shared/lib/api";
import { PAGINATION } from "@/shared/config/app";
import { SERVICE_REGLEMENT_ENDPOINTS } from "@/portails/Dr/modules/ServiceReglement/api/endpoints";
import { formatMontant } from "@/shared/lib/format";
import { optionsTaillePagination } from "@/shared/lib/pagination";
import { useAuth } from "@/shared/hooks/use-auth";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Avatar, AvatarFallback } from "@/shared/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/shared/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/shared/components/ui/tooltip";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/shared/components/ui/empty";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel,
  AlertDialogMedia,
} from "@/shared/components/ui/alert-dialog";
import type { Stats, Fiche, FichesDepotResponse } from "@/portails/Dr/modules/ServiceReglement/types";

type StatutCfg = { badge: string; label: string; row: string };
const STATUT_CFG: Record<string, StatutCfg> = {
  envoyee: {
    badge: "border-transparent bg-success/10 text-success",
    label: "Envoyée",
    row:   "border-l-4! border-l-success! bg-success/[0.03]",
  },
  recue: {
    badge: "border-transparent bg-warning/10 text-warning",
    label: "Reçue",
    row:   "border-l-4! border-l-warning! bg-warning/[0.03]",
  },
  cree: {
    badge: "border-transparent bg-muted text-muted-foreground",
    label: "Créée",
    row:   "border-l-4! border-l-muted-foreground/60!",
  },
};

const STATS_CFG: { key: keyof Stats; label: string; iconClass: string }[] = [
  { key: "cree",       label: "Créées",     iconClass: "bg-muted text-muted-foreground" },
  { key: "envoyee",    label: "Envoyées",   iconClass: "bg-success/10 text-success" },
  { key: "recue",      label: "Reçues",     iconClass: "bg-warning/10 text-warning" },
  { key: "en_attente", label: "En attente", iconClass: "bg-primary/10 text-primary" },
];

const PAGE_SIZE_OPTIONS = optionsTaillePagination();

export default function ListeFichesDepot() {
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const peutSupprimer = hasRole("CHEF_SR");

  const [stats,   setStats]   = useState<Stats | null>(null);
  const [fiches,  setFiches]  = useState<Fiche[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(false);

  const [search,          setSearch]          = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filterStatut,    setFilterStatut]    = useState("");
  const [page,            setPage]            = useState<number>(PAGINATION.PAGE_PAR_DEFAUT);
  const [pageSize,        setPageSize]        = useState(String(PAGINATION.TAILLE_PAR_DEFAUT));
  const [total,           setTotal]           = useState(0);
  const [totalPages,      setTotalPages]      = useState(1);

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

    const params = new URLSearchParams({ page: String(page), limit: pageSize });
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (filterStatut)    params.set("statut", filterStatut);

    return requeteApi<FichesDepotResponse>(`${SERVICE_REGLEMENT_ENDPOINTS.FICHES_DEPENSES}?${params.toString()}`)
      .then((data) => {
        setStats(data.stats ?? null);
        setFiches(data.fiches ?? []);
        setTotal(data.pagination?.total ?? 0);
        setTotalPages(Math.max(1, data.pagination?.total_pages ?? 1));
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [page, pageSize, debouncedSearch, filterStatut]);

  useEffect(() => {
    let actif = true;
    Promise.resolve().then(() => { if (actif) chargerFiches(); });
    return () => { actif = false; };
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
      chargerFiches();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur lors de la suppression.");
    } finally {
      setDeletingLoading(false);
    }
  }

  const hasActiveFilters = Boolean(search || filterStatut);

  const resetFilters = () => {
    setSearch("");
    setDebouncedSearch("");
    setFilterStatut("");
    setPage(1);
  };

  return (
    <TooltipProvider>
      <div className="space-y-5">

        {}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {STATS_CFG.map(({ key, label, iconClass }) => (
            <Card key={key}>
              <CardContent className="flex items-center justify-between">
                <div>
                  <p className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    {label}
                  </p>
                  {loading ? (
                    <Skeleton className="h-7 w-12" />
                  ) : error ? (
                    <p className="font-heading text-xl font-bold text-muted-foreground/40">—</p>
                  ) : (
                    <p className="font-heading text-2xl font-bold text-foreground">{stats?.[key] ?? 0}</p>
                  )}
                </div>
                <span className={`flex size-9 items-center justify-center rounded-lg ${iconClass}`}>
                  <Clock className="size-4" />
                </span>
              </CardContent>
            </Card>
          ))}
        </div>

        {}
        <Card className="gap-0 overflow-hidden py-0">

          {}
          <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 border-b py-4">
            <div>
              <CardTitle>Toutes les fiches</CardTitle>
              <CardDescription>
                {loading ? "Chargement…" : `${total} fiche${total !== 1 ? "s" : ""}`}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {}
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Référence, agent…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-80 pl-8"
                />
              </div>
              {}
              <Select
                value={filterStatut || "all"}
                onValueChange={(v) => { setFilterStatut(v === "all" ? "" : v); setPage(1); }}
              >
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Tous les statuts" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  <SelectItem value="cree">Créée</SelectItem>
                  <SelectItem value="envoyee">Envoyée</SelectItem>
                  <SelectItem value="recue">Reçue</SelectItem>
                </SelectContent>
              </Select>
              {}
              {hasActiveFilters && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="destructive" size="icon" onClick={resetFilters}>
                      <X className="size-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Réinitialiser les filtres</TooltipContent>
                </Tooltip>
              )}
            </div>
          </CardHeader>

          {}
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-b-2 border-b-primary/20 bg-muted/60 hover:bg-muted/60">
                  <TableHead className="h-11 text-[11px] font-bold uppercase tracking-wider text-foreground">Référence</TableHead>
                  <TableHead className="h-11 text-[11px] font-bold uppercase tracking-wider text-foreground">Date</TableHead>
                  <TableHead className="h-11 text-[11px] font-bold uppercase tracking-wider text-foreground">Montant total (FCFA)</TableHead>
                  <TableHead className="h-11 text-[11px] font-bold uppercase tracking-wider text-foreground">Généré par</TableHead>
                  <TableHead className="h-11 text-[11px] font-bold uppercase tracking-wider text-foreground">Statut</TableHead>
                  <TableHead className="h-11 text-right text-[11px] font-bold uppercase tracking-wider text-foreground">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, idx) => (
                    <TableRow key={idx}>
                      <TableCell><Skeleton className="h-4 w-36" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Skeleton className="size-6 rounded-full" />
                          <Skeleton className="h-4 w-20" />
                        </div>
                      </TableCell>
                      <TableCell><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
                      <TableCell />
                    </TableRow>
                  ))
                ) : error ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10">
                      <Empty>
                        <EmptyHeader>
                          <EmptyMedia variant="icon" className="bg-destructive/10 text-destructive">
                            <Inbox />
                          </EmptyMedia>
                          <EmptyTitle>Erreur de chargement</EmptyTitle>
                          <EmptyDescription>Veuillez rafraîchir la page.</EmptyDescription>
                        </EmptyHeader>
                      </Empty>
                    </TableCell>
                  </TableRow>
                ) : fiches.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10">
                      <Empty>
                        <EmptyHeader>
                          <EmptyMedia variant="icon">
                            <Inbox />
                          </EmptyMedia>
                          <EmptyTitle>Aucune fiche trouvée</EmptyTitle>
                          <EmptyDescription>Essayez de modifier vos filtres de recherche.</EmptyDescription>
                        </EmptyHeader>
                      </Empty>
                    </TableCell>
                  </TableRow>
                ) : (
                  fiches.map((f) => {
                    const st = STATUT_CFG[f.statut] ?? STATUT_CFG.cree;
                    const initials = f.genere_par.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
                    return (
                      <TableRow
                        key={f.reference}
                        className={`cursor-pointer ${st.row}`}
                        onClick={() => navigate(`/dr/fiche/${encodeURIComponent(f.reference)}`)}
                      >
                        <TableCell className="font-mono font-semibold text-primary">{f.reference}</TableCell>
                        <TableCell className="text-muted-foreground">{f.date_creation}</TableCell>
                        <TableCell>
                          <span className="font-semibold text-foreground">{formatMontant(f.montant_total)}</span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Avatar size="sm">
                              <AvatarFallback className="bg-primary text-[10px] font-bold text-primary-foreground">
                                {initials}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-muted-foreground">{f.genere_par}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={st.badge}>{st.label}</Badge>
                        </TableCell>
                        <TableCell
                          className="text-right"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center justify-end gap-1">
                            {f.chemin_fichier && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button variant="ghost" size="icon" asChild>
                                    <a href={f.chemin_fichier} target="_blank" rel="noopener noreferrer">
                                      <FileDown className="size-4 text-emerald-600 dark:text-emerald-400" />
                                    </a>
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Télécharger le fichier</TooltipContent>
                              </Tooltip>
                            )}
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => navigate(`/dr/fiche/${encodeURIComponent(f.reference)}`)}
                                >
                                  <FileSearch className="size-4 text-blue-600 dark:text-blue-400" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Voir le détail</TooltipContent>
                            </Tooltip>
                            {peutSupprimer && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setDeleting(f)}
                                  >
                                    <Trash2 className="size-4 text-destructive" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Supprimer</TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>

          {}
          {!loading && !error && total > 0 && (
            <div className="flex items-center justify-between border-t px-4 py-3">
              <div className="flex items-center gap-2">
                <p className="text-xs text-muted-foreground">Lignes par page</p>
                <Select
                  value={pageSize}
                  onValueChange={(v) => { setPageSize(v); setPage(1); }}
                >
                  <SelectTrigger className="h-8 w-[76px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAGE_SIZE_OPTIONS.map(({ value, label }) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center gap-4">
                  <p className="text-xs text-muted-foreground">
                    Page {page} sur {totalPages}
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
                    {Array.from({ length: totalPages }).map((_, i) => (
                      <Button
                        key={i}
                        variant={page === i + 1 ? "default" : "ghost"}
                        size="icon"
                        onClick={() => setPage(i + 1)}
                      >
                        {i + 1}
                      </Button>
                    ))}
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
              )}
            </div>
          )}
        </Card>

        <AlertDialog open={!!deleting} onOpenChange={(o) => { if (!o) setDeleting(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogMedia className="bg-destructive/10 text-destructive">
                <Trash2 />
              </AlertDialogMedia>
              <AlertDialogTitle>Supprimer cette fiche de dépôt ?</AlertDialogTitle>
              <AlertDialogDescription>
                Cette action est définitive et ne peut pas être annulée. Les mouvements,
                l'historique et le fichier Excel de la fiche{" "}
                <span className="font-mono font-semibold">{deleting?.reference}</span> seront
                supprimés.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deletingLoading}>Annuler</AlertDialogCancel>
              <AlertDialogAction variant="destructive" onClick={confirmerSuppression} disabled={deletingLoading}>
                {deletingLoading && <Loader2 className="size-3.5 animate-spin" />}
                Supprimer
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

      </div>
    </TooltipProvider>
  );
}
