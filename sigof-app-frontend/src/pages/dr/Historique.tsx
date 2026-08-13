import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Trash2, Loader2, Inbox, ShieldAlert, X, CalendarDays, FileSearch,
  ChevronLeft, ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { requeteApi } from "@/lib/api";
import { API_ENDPOINTS, PAGINATION } from "@/config/app";
import { optionsTaillePagination } from "@/lib/pagination";
import { useAuth } from "@/hooks/use-auth";
import type { HistoriqueEntree, HistoriqueResponse, UtilisateursSRResponse } from "@/interfaces/pool-sr";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel,
  AlertDialogMedia,
} from "@/components/ui/alert-dialog";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty";

const STATUT_BADGE: Record<string, string> = {
  cree:    "border-transparent bg-muted text-muted-foreground",
  envoyee: "border-transparent bg-success/10 text-success",
  recue:   "border-transparent bg-warning/10 text-warning",
};
const STATUT_LABEL: Record<string, string> = {
  cree: "Créée",
  envoyee: "Envoyée",
  recue: "Reçue",
};

const ACTION_LABEL: Record<string, string> = {
  CREATION: "Création",
  CHANGEMENT_STATUT: "Changement de statut",
};

const PAGE_SIZE_OPTIONS = optionsTaillePagination();

export default function Historique() {
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const peutConsulter = hasRole("AGENT_SR");

  const [historique, setHistorique] = useState<HistoriqueEntree[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(false);

  const [dateDebut,       setDateDebut]       = useState("");
  const [dateFin,         setDateFin]         = useState("");
  const [filterUtilisateur, setFilterUtilisateur] = useState("all");
  const [page,            setPage]            = useState<number>(PAGINATION.PAGE_PAR_DEFAUT);
  const [pageSize,        setPageSize]        = useState(String(PAGINATION.TAILLE_PAR_DEFAUT));
  const [total,           setTotal]           = useState(0);
  const [totalPages,      setTotalPages]      = useState(1);

  const [utilisateurs, setUtilisateurs] = useState<{ id: number; label: string }[]>([]);
  const [deleting, setDeleting] = useState<HistoriqueEntree | null>(null);
  const [deletingLoading, setDeletingLoading] = useState(false);

  useEffect(() => {
    if (!peutConsulter) return;
    requeteApi<UtilisateursSRResponse>(`${API_ENDPOINTS.POOL_SR.UTILISATEURS}?limit=all`)
      .then((data) => {
        setUtilisateurs((data.utilisateurs ?? []).map((u) => ({
          id: u.id,
          label: `${u.nom} ${u.prenom}`,
        })));
      })
      .catch(() => {});
  }, [peutConsulter]);

  const chargerHistorique = useCallback(() => {
    setLoading(true);
    setError(false);
    const params = new URLSearchParams({ page: String(page), limit: pageSize });
    if (dateDebut) params.set("date_debut", dateDebut);
    if (dateFin) params.set("date_fin", dateFin);
    if (filterUtilisateur !== "all") params.set("utilisateur_id", filterUtilisateur);
    return requeteApi<HistoriqueResponse>(`${API_ENDPOINTS.POOL_SR.HISTORIQUE}?${params.toString()}`)
      .then((data) => {
        setHistorique(data.historique ?? []);
        setTotal(data.pagination?.total ?? 0);
        setTotalPages(Math.max(1, data.pagination?.total_pages ?? 1));
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [dateDebut, dateFin, filterUtilisateur, page, pageSize]);

  useEffect(() => {
    if (!peutConsulter) return;
    Promise.resolve().then(() => chargerHistorique());
  }, [chargerHistorique, peutConsulter]);

  const hasActiveFilters = Boolean(dateDebut || dateFin || filterUtilisateur !== "all");
  const resetFiltres = () => {
    setDateDebut("");
    setDateFin("");
    setFilterUtilisateur("all");
    setPage(1);
  };

  async function confirmerSuppression() {
    if (!deleting) return;
    setDeletingLoading(true);
    try {
      await requeteApi<{ ok: boolean }>(`${API_ENDPOINTS.POOL_SR.HISTORIQUE}/${deleting.id}`, {
        method: "DELETE",
      });
      toast.success("Entrée d'historique supprimée.");
      setDeleting(null);
      chargerHistorique();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur lors de la suppression.");
    } finally {
      setDeletingLoading(false);
    }
  }

  if (!peutConsulter) {
    return (
      <Card>
        <CardContent className="py-14">
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon" className="bg-destructive/10 text-destructive">
                <ShieldAlert />
              </EmptyMedia>
              <EmptyTitle>Accès refusé</EmptyTitle>
              <EmptyDescription>
                Vous n'avez pas les droits nécessaires pour consulter l'historique des fiches de dépôt.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        </CardContent>
      </Card>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-5">
        <Card className="gap-0 overflow-hidden py-0">

          {}
          <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 border-b py-4">
            <div>
              <CardTitle>Historique des fiches de dépôt</CardTitle>
              <CardDescription>
                {loading ? "Chargement…" : `${total} entrée${total !== 1 ? "s" : ""}`}
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <InputGroup className="h-9 w-[160px] bg-background">
                <InputGroupAddon>
                  <CalendarDays className="size-3.5" />
                </InputGroupAddon>
                <InputGroupInput
                  type="date"
                  value={dateDebut}
                  onChange={(e) => { setDateDebut(e.target.value); setPage(1); }}
                  placeholder="Du"
                />
              </InputGroup>
              <InputGroup className="h-9 w-[160px] bg-background">
                <InputGroupAddon>
                  <CalendarDays className="size-3.5" />
                </InputGroupAddon>
                <InputGroupInput
                  type="date"
                  value={dateFin}
                  onChange={(e) => { setDateFin(e.target.value); setPage(1); }}
                  placeholder="Au"
                />
              </InputGroup>
              <Select
                value={filterUtilisateur}
                onValueChange={(v) => { setFilterUtilisateur(v); setPage(1); }}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Tous les utilisateurs" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les utilisateurs</SelectItem>
                  {utilisateurs.map((u) => (
                    <SelectItem key={u.id} value={String(u.id)}>{u.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {hasActiveFilters && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="destructive" size="icon" onClick={resetFiltres}>
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
                  <TableHead className="h-11 text-[11px] font-bold uppercase tracking-wider text-foreground">Date</TableHead>
                  <TableHead className="h-11 text-[11px] font-bold uppercase tracking-wider text-foreground">Fiche</TableHead>
                  <TableHead className="h-11 text-[11px] font-bold uppercase tracking-wider text-foreground">Action</TableHead>
                  <TableHead className="h-11 text-[11px] font-bold uppercase tracking-wider text-foreground">Statut</TableHead>
                  <TableHead className="h-11 text-[11px] font-bold uppercase tracking-wider text-foreground">Utilisateur</TableHead>
                  <TableHead className="h-11 text-[11px] font-bold uppercase tracking-wider text-foreground">Commentaire</TableHead>
                  <TableHead className="h-11 text-right text-[11px] font-bold uppercase tracking-wider text-foreground">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 6 }).map((_, idx) => (
                    <TableRow key={idx}>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-24 rounded-full" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-36" /></TableCell>
                      <TableCell />
                    </TableRow>
                  ))
                ) : error ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-10">
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
                ) : historique.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-10">
                      <Empty>
                        <EmptyHeader>
                          <EmptyMedia variant="icon">
                            <Inbox />
                          </EmptyMedia>
                          <EmptyTitle>Aucune entrée trouvée</EmptyTitle>
                          <EmptyDescription>Essayez de modifier vos filtres.</EmptyDescription>
                        </EmptyHeader>
                      </Empty>
                    </TableCell>
                  </TableRow>
                ) : (
                  historique.map((h) => (
                    <TableRow
                      key={h.id}
                      className={h.fiche_reference ? "cursor-pointer" : undefined}
                      onClick={() =>
                        h.fiche_reference &&
                        navigate(`/dr/fiche/${encodeURIComponent(h.fiche_reference)}`)
                      }
                    >
                      <TableCell className="whitespace-nowrap text-muted-foreground">{h.date_action}</TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        {h.fiche_reference ? (
                          <button
                            onClick={() => navigate(`/dr/fiche/${encodeURIComponent(h.fiche_reference!)}`)}
                            className="font-mono font-semibold text-primary hover:underline"
                          >
                            {h.fiche_reference}
                          </button>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {ACTION_LABEL[h.action] ?? h.action}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          {h.ancien_statut ? (
                            <Badge className={STATUT_BADGE[h.ancien_statut] ?? "border-transparent bg-muted text-muted-foreground"}>
                              {STATUT_LABEL[h.ancien_statut] ?? h.ancien_statut}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                          {h.ancien_statut && h.nouveau_statut && (
                            <span className="text-muted-foreground">→</span>
                          )}
                          {h.nouveau_statut && (
                            <Badge className={STATUT_BADGE[h.nouveau_statut] ?? "border-transparent bg-muted text-muted-foreground"}>
                              {STATUT_LABEL[h.nouveau_statut] ?? h.nouveau_statut}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {h.utilisateur.nom_complet}
                        <span className="ml-1 text-xs text-muted-foreground/70">· {h.utilisateur.matricule}</span>
                      </TableCell>
                      <TableCell className="max-w-[220px] truncate text-muted-foreground" title={h.commentaire ?? undefined}>
                        {h.commentaire ?? "—"}
                      </TableCell>
                      <TableCell
                        className="text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-end gap-1">
                          {h.fiche_reference && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => navigate(`/dr/fiche/${encodeURIComponent(h.fiche_reference!)}`)}
                                >
                                  <FileSearch className="size-4 text-blue-600 dark:text-blue-400" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Voir la fiche</TooltipContent>
                            </Tooltip>
                          )}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" onClick={() => setDeleting(h)}>
                                <Trash2 className="size-4 text-destructive" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Supprimer</TooltipContent>
                          </Tooltip>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>

          {}
          {!loading && !error && total > 0 && (
            <div className="flex items-center justify-between border-t px-4 py-3">
              <div className="flex items-center gap-2">
                <p className="text-xs text-muted-foreground">Lignes par page</p>
                <Select value={pageSize} onValueChange={(v) => { setPageSize(v); setPage(1); }}>
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
      </div>

      {}
      <AlertDialog open={!!deleting} onOpenChange={(o) => { if (!o) setDeleting(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-destructive/10 text-destructive">
              <Trash2 />
            </AlertDialogMedia>
            <AlertDialogTitle>Supprimer cette entrée d'historique ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est définitive et ne peut pas être annulée.
              {deleting?.fiche_reference && (
                <> L'entrée concerne la fiche <span className="font-mono font-semibold">{deleting.fiche_reference}</span>.</>
              )}
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
    </TooltipProvider>
  );
}
