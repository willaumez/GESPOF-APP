import { useState, useEffect, useCallback } from "react";
import {
  Search, ShieldAlert, X, ChevronLeft, ChevronRight,
  Radio, Users, History, RefreshCw, LayoutList, SquareKanban, ChartArea,
} from "lucide-react";
import type { DateRange } from "react-day-picker";
import { requeteApi } from "@/shared/lib/api";
import { PAGINATION } from "@/shared/config/app";
import { AUDIT_CONNEXIONS_ENDPOINT } from "@/shared/api/audit-connexions";
import { UTILISATEURS_ENDPOINT } from "@/shared/api/utilisateurs";
import { optionsTaillePagination } from "@/shared/lib/pagination";
import { useAuth } from "@/shared/hooks/use-auth";
import { cn } from "@/shared/lib/utils";
import { metiersAssignablesPar } from "@/shared/lib/metiers";
import type { Portail } from "@/shared/hooks/auth-context";
import type { UtilisateursResponse } from "@/shared/types/utilisateur.interface";
import type {
  AuditConnexionsPointSerie,
  AuditConnexionsResponse,
  AuditConnexionsUtilisateurSerie,
  AuditRepartitions,
  SessionConnexion,
} from "@/shared/types/audit-connexion.interface";
import {
  PeriodDatePicker,
  periodeVersIso,
} from "@/shared/components/date/PeriodDatePicker";
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
import { ToggleGroup, ToggleGroupItem } from "@/shared/components/ui/toggle-group";
import { ChartConnexions } from "./ChartConnexions";
import { VueKanbanAudit } from "./VueKanbanAudit";
import { BadgeVous, estCompteConnecte, initiales, partieDate } from "./affichage";

/**
 * Journal des connexions — composant transverse partagé par les 4 portails.
 *
 * - Avec `portail` (sp / sr / sof) : uniquement les sessions du service.
 * - Sans `portail` (page Admin) : toutes les sessions.
 */

const LIBELLES: Record<Portail, { titre: string; sousTitre: string }> = {
  sp: {
    titre: "Audit des connexions SP",
    sousTitre: "Sessions des utilisateurs du Service de Prévision",
  },
  sr: {
    titre: "Audit des connexions SR",
    sousTitre: "Sessions des utilisateurs du Service Règlement",
  },
  sof: {
    titre: "Audit des connexions SOF",
    sousTitre: "Sessions des utilisateurs du Service des Opérations Financières",
  },
  admin: {
    titre: "Audit des connexions",
    sousTitre: "Journal de toutes les sessions, tous services confondus",
  },
};

const PAGE_SIZE_OPTIONS = optionsTaillePagination();

type VueAudit = "liste" | "kanban" | "graphique";

interface AuditConnexionsProps {
  portail?: Portail;
}

export default function AuditConnexions({ portail }: AuditConnexionsProps) {
  const { user, hasAcces } = useAuth();
  const peutConsulter =
    hasAcces("CONSULTER_AUDIT_CONNEXIONS")
    || metiersAssignablesPar(user?.roles ?? []).length > 0;

  const libelles = LIBELLES[portail ?? "admin"];

  const [sessions, setSessions] = useState<SessionConnexion[]>([]);
  const [enLigne, setEnLigne] = useState<SessionConnexion[]>([]);
  const [serie, setSerie] = useState<AuditConnexionsPointSerie[]>([]);
  const [parUtilisateur, setParUtilisateur] = useState<AuditConnexionsUtilisateurSerie[]>([]);
  const [repartitions, setRepartitions] = useState<AuditRepartitions | null>(null);
  const [vue, setVue] = useState<VueAudit>("liste");
  const [resume, setResume] = useState({
    utilisateurs_connectes: 0,
    sessions_actives: 0,
    connexions_aujourdhui: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [periode, setPeriode] = useState<DateRange | undefined>();
  const [statut, setStatut] = useState("all");
  const [filterUtilisateur, setFilterUtilisateur] = useState("all");
  const [page, setPage] = useState<number>(PAGINATION.PAGE_PAR_DEFAUT);
  const [pageSize, setPageSize] = useState(String(PAGINATION.TAILLE_PAR_DEFAUT));
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [utilisateurs, setUtilisateurs] = useState<{ id: number; label: string }[]>([]);

  useEffect(() => {
    const id = window.setTimeout(() => setSearchDebounced(search.trim()), 350);
    return () => window.clearTimeout(id);
  }, [search]);

  useEffect(() => {
    if (!peutConsulter) return;
    const params = new URLSearchParams({ limit: "all" });
    if (portail) params.set("portail", portail);
    requeteApi<UtilisateursResponse>(`${UTILISATEURS_ENDPOINT}?${params}`)
      .then((data) => {
        setUtilisateurs((data.utilisateurs ?? []).map((u) => ({
          id: u.id,
          label: `${u.prenom} ${u.nom}`.trim(),
        })));
      })
      .catch(() => {});
  }, [peutConsulter, portail]);

  const charger = useCallback(() => {
    setLoading(true);
    setError(false);
    const limite = vue === "kanban" ? "all" : pageSize;
    const { dateDebut, dateFin } = periodeVersIso(periode);
    const params = new URLSearchParams({ page: String(vue === "kanban" ? 1 : page), limit: limite });
    if (portail) params.set("portail", portail);
    if (searchDebounced) params.set("search", searchDebounced);
    if (dateDebut) params.set("date_debut", dateDebut);
    if (dateFin) params.set("date_fin", dateFin);
    if (statut !== "all") params.set("statut", statut);
    if (filterUtilisateur !== "all") params.set("utilisateur_id", filterUtilisateur);

    return requeteApi<AuditConnexionsResponse>(`${AUDIT_CONNEXIONS_ENDPOINT}?${params}`)
      .then((data) => {
        setSessions(data.sessions ?? []);
        setEnLigne(data.en_ligne ?? []);
        setSerie(data.serie ?? []);
        setParUtilisateur(data.par_utilisateur ?? []);
        setRepartitions(data.repartitions ?? null);
        setResume(data.resume ?? {
          utilisateurs_connectes: 0,
          sessions_actives: 0,
          connexions_aujourdhui: 0,
        });
        setTotal(data.pagination?.total ?? 0);
        setTotalPages(Math.max(1, data.pagination?.total_pages ?? 1));
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [portail, searchDebounced, periode, statut, filterUtilisateur, page, pageSize, vue]);

  useEffect(() => {
    if (!peutConsulter) return;
    void charger();
  }, [charger, peutConsulter]);

  useEffect(() => {
    if (!peutConsulter) return;
    const id = window.setInterval(() => { void charger(); }, 30_000);
    return () => window.clearInterval(id);
  }, [charger, peutConsulter]);

  const hasActiveFilters = Boolean(
    searchDebounced || periode?.from || statut !== "all" || filterUtilisateur !== "all",
  );
  const resetFiltres = () => {
    setSearch("");
    setSearchDebounced("");
    setPeriode(undefined);
    setStatut("all");
    setFilterUtilisateur("all");
    setPage(1);
  };

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
                Vous n'avez pas les droits nécessaires pour consulter l'audit des connexions.
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
        <div className="grid gap-3 sm:grid-cols-3">
          <Card className="py-4">
            <CardContent className="flex items-center gap-3 px-5">
              <span className="flex size-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
                <Radio className="size-5" />
              </span>
              <div>
                <p className="text-2xl font-semibold tabular-nums leading-none">
                  {loading ? "—" : resume.utilisateurs_connectes}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">Utilisateur{resume.utilisateurs_connectes !== 1 ? "s" : ""} en ligne</p>
              </div>
            </CardContent>
          </Card>
          <Card className="py-4">
            <CardContent className="flex items-center gap-3 px-5">
              <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Users className="size-5" />
              </span>
              <div>
                <p className="text-2xl font-semibold tabular-nums leading-none">
                  {loading ? "—" : resume.sessions_actives}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">Session{resume.sessions_actives !== 1 ? "s" : ""} active{resume.sessions_actives !== 1 ? "s" : ""}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="py-4">
            <CardContent className="flex items-center gap-3 px-5">
              <span className="flex size-10 items-center justify-center rounded-lg bg-amber-500/10 text-amber-700">
                <History className="size-5" />
              </span>
              <div>
                <p className="text-2xl font-semibold tabular-nums leading-none">
                  {loading ? "—" : resume.connexions_aujourdhui}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">Connexion{resume.connexions_aujourdhui !== 1 ? "s" : ""} aujourd'hui</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {enLigne.length > 0 && (
          <Card className="gap-0 overflow-hidden py-0">
            <CardHeader className="border-b py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <CardTitle>Actuellement en ligne</CardTitle>
                  <CardDescription>
                    Utilisateurs dont la session est ouverte en ce moment.
                  </CardDescription>
                </div>
                <Badge className="shrink-0 border-transparent bg-emerald-500/10 font-medium text-emerald-700">
                  {enLigne.length}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <ul className="divide-y">
                {[...enLigne]
                  .sort((a, b) => {
                    const aMoi = estCompteConnecte(a.utilisateur.email, user?.email) ? 0 : 1;
                    const bMoi = estCompteConnecte(b.utilisateur.email, user?.email) ? 0 : 1;
                    return aMoi - bMoi;
                  })
                  .map((s) => {
                  const moi = estCompteConnecte(s.utilisateur.email, user?.email);
                  return (
                  <li
                    key={s.id}
                    className={cn(
                      "flex items-center gap-3 px-5 py-3",
                      moi && "bg-primary/[0.06]",
                    )}
                    title={`${s.utilisateur.nom_complet} · ${s.utilisateur.matricule}`}
                  >
                    <span className="relative shrink-0">
                      <Avatar className="size-9">
                        <AvatarFallback className={cn(
                          "text-[11px] font-semibold",
                          moi && "bg-primary text-primary-foreground",
                        )}>
                          {initiales(s.utilisateur.nom_complet)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-background bg-emerald-500" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 truncate text-sm font-medium leading-tight">
                        <span className="truncate">{s.utilisateur.nom_complet}</span>
                        {moi && <BadgeVous />}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {s.role.libelle}
                        <span className="text-muted-foreground/70"> · {s.utilisateur.matricule}</span>
                      </p>
                    </div>
                    <time className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                      {s.heure_connexion}
                    </time>
                  </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        )}

        <Card className="gap-0 overflow-hidden py-0">
          <CardHeader className="flex flex-col items-stretch gap-3 border-b py-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle>{libelles.titre}</CardTitle>
                <CardDescription>
                  {vue === "graphique"
                    ? "Connexions et déconnexions sur la période sélectionnée"
                    : loading
                      ? "Chargement…"
                      : `${total} session${total !== 1 ? "s" : ""} · ${libelles.sousTitre}`}
                </CardDescription>
              </div>
              <div className="ml-auto flex items-center gap-2">
                <ToggleGroup
                  type="single"
                  value={vue === "graphique" ? "" : vue}
                  onValueChange={(v) => {
                    if (v === "liste" || v === "kanban") setVue(v);
                  }}
                  variant="outline"
                  size="sm"
                  className="rounded-lg"
                >
                  <ToggleGroupItem value="liste" aria-label="Vue liste" className="gap-1.5 px-2.5">
                    <LayoutList className="size-3.5" />
                    <span className="hidden sm:inline">Liste</span>
                  </ToggleGroupItem>
                  <ToggleGroupItem value="kanban" aria-label="Vue kanban" className="gap-1.5 px-2.5">
                    <SquareKanban className="size-3.5" />
                    <span className="hidden sm:inline">Kanban</span>
                  </ToggleGroupItem>
                </ToggleGroup>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant={vue === "graphique" ? "default" : "outline"}
                      size="sm"
                      className="h-7 gap-1.5 rounded-lg px-2.5"
                      aria-pressed={vue === "graphique"}
                      aria-label="Afficher le graphique"
                      onClick={() => setVue("graphique")}
                    >
                      <ChartArea className="size-3.5" />
                      <span className="hidden sm:inline">Graphique</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Graphique</TooltipContent>
                </Tooltip>
              </div>
            </div>
            {vue !== "graphique" && (
            <div className="flex w-full flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  placeholder="Nom, matricule…"
                  className="h-9 w-[180px] bg-background pl-8"
                />
              </div>
              <Select value={statut} onValueChange={(v) => { setStatut(v); setPage(1); }}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  <SelectItem value="en_ligne">En ligne</SelectItem>
                  <SelectItem value="deconnecte">Déconnecté</SelectItem>
                </SelectContent>
              </Select>
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
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="icon" onClick={() => { void charger(); }}>
                    <RefreshCw className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Actualiser</TooltipContent>
              </Tooltip>
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
              <PeriodDatePicker
                portail={portail ?? "admin"}
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
            )}
          </CardHeader>

          <CardContent className="p-0">
            {vue === "graphique" ? (
              <ChartConnexions
                serie={serie}
                parUtilisateur={parUtilisateur}
                repartitions={repartitions ?? undefined}
                emailConnecte={user?.email}
                loading={loading}
                dansCarte
                vueAdmin={!portail}
              />
            ) : vue === "kanban" ? (
              <VueKanbanAudit
                sessions={sessions}
                loading={loading}
                error={error}
                emailConnecte={user?.email}
                afficherService={!portail}
              />
            ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-b-2 border-b-primary/20 bg-muted/60 hover:bg-muted/60">
                  <TableHead className="h-11 text-[11px] font-bold uppercase tracking-wider text-foreground">Utilisateur</TableHead>
                  <TableHead className="h-11 text-[11px] font-bold uppercase tracking-wider text-foreground">Métier</TableHead>
                  {!portail && (
                    <TableHead className="h-11 text-[11px] font-bold uppercase tracking-wider text-foreground">Service</TableHead>
                  )}
                  <TableHead className="h-11 text-[11px] font-bold uppercase tracking-wider text-foreground">Connexion</TableHead>
                  <TableHead className="h-11 text-[11px] font-bold uppercase tracking-wider text-foreground">Déconnexion</TableHead>
                  <TableHead className="h-11 text-[11px] font-bold uppercase tracking-wider text-foreground">Durée</TableHead>
                  <TableHead className="h-11 text-[11px] font-bold uppercase tracking-wider text-foreground">Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 6 }).map((_, idx) => (
                    <TableRow key={idx}>
                      <TableCell><Skeleton className="h-8 w-40" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-28 rounded-full" /></TableCell>
                      {!portail && <TableCell><Skeleton className="h-4 w-16" /></TableCell>}
                      <TableCell><Skeleton className="h-8 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-8 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-24 rounded-full" /></TableCell>
                    </TableRow>
                  ))
                ) : error ? (
                  <TableRow>
                    <TableCell colSpan={portail ? 6 : 7} className="py-10">
                      <Empty>
                        <EmptyHeader>
                          <EmptyMedia variant="icon" className="bg-destructive/10 text-destructive">
                            <History />
                          </EmptyMedia>
                          <EmptyTitle>Erreur de chargement</EmptyTitle>
                          <EmptyDescription>Veuillez rafraîchir la page.</EmptyDescription>
                        </EmptyHeader>
                      </Empty>
                    </TableCell>
                  </TableRow>
                ) : sessions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={portail ? 6 : 7} className="py-10">
                      <Empty>
                        <EmptyHeader>
                          <EmptyMedia variant="icon">
                            <History />
                          </EmptyMedia>
                          <EmptyTitle>Aucune session trouvée</EmptyTitle>
                          <EmptyDescription>
                            {hasActiveFilters
                              ? "Essayez de modifier vos filtres."
                              : "Les connexions apparaîtront ici dès qu'un utilisateur se connectera."}
                          </EmptyDescription>
                        </EmptyHeader>
                      </Empty>
                    </TableCell>
                  </TableRow>
                ) : (
                  sessions.map((s) => {
                    const moi = estCompteConnecte(s.utilisateur.email, user?.email);
                    return (
                    <TableRow
                      key={s.id}
                      className={cn(moi && "bg-primary/[0.06] hover:bg-primary/[0.1]")}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <span className="relative shrink-0">
                            <Avatar className="size-8">
                              <AvatarFallback className={cn(
                                "text-[10px]",
                                moi && "bg-primary text-primary-foreground",
                              )}>
                                {initiales(s.utilisateur.nom_complet)}
                              </AvatarFallback>
                            </Avatar>
                            {s.statut === "EN_LIGNE" && (
                              <span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-background bg-emerald-500" />
                            )}
                          </span>
                          <div className="min-w-0 leading-tight">
                            <p className="flex items-center gap-1.5 truncate text-sm font-medium">
                              <span className="truncate">{s.utilisateur.nom_complet}</span>
                              {moi && <BadgeVous />}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {s.utilisateur.matricule}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className="border-transparent bg-muted font-normal text-muted-foreground">
                          {s.role.libelle}
                        </Badge>
                      </TableCell>
                      {!portail && (
                        <TableCell className="text-muted-foreground">
                          {s.portail?.valeur ?? "—"}
                        </TableCell>
                      )}
                      <TableCell className="whitespace-nowrap">
                        <p className="text-sm">{partieDate(s.date_connexion)}</p>
                        <p className="font-mono text-xs tabular-nums text-muted-foreground">{s.heure_connexion}</p>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {s.date_deconnexion ? (
                          <>
                            <p className="text-sm">{partieDate(s.date_deconnexion)}</p>
                            <p className="font-mono text-xs tabular-nums text-muted-foreground">
                              {s.heure_deconnexion}
                              {s.motif_deconnexion ? ` · ${s.motif_deconnexion.libelle}` : ""}
                            </p>
                          </>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap font-mono text-sm tabular-nums text-muted-foreground">
                        {s.duree}
                      </TableCell>
                      <TableCell>
                        {s.statut === "EN_LIGNE" ? (
                          <Badge className="border-transparent bg-emerald-500/10 text-emerald-700">
                            <span className="mr-1.5 inline-flex size-1.5 rounded-full bg-emerald-500" />
                            En ligne
                          </Badge>
                        ) : (
                          <Badge className="border-transparent bg-muted text-muted-foreground">
                            Déconnecté
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
            )}
          </CardContent>

          {vue === "liste" && !loading && !error && total > 0 && (
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
    </TooltipProvider>
  );
}
