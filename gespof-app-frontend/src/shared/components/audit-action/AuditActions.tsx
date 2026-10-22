import { useState, useEffect, useCallback } from "react";
import {
  Search, ShieldAlert, X, ChevronLeft, ChevronRight,
  History, RefreshCw, ScrollText, Eye,
} from "lucide-react";
import type { DateRange } from "react-day-picker";
import { requeteApi } from "@/shared/lib/api";
import { AUDIT_ACTIONS_ENDPOINT } from "@/shared/api/audit-actions";
import { UTILISATEURS_ENDPOINT } from "@/shared/api/utilisateurs";
import { useAuth } from "@/shared/hooks/use-auth";
import { cn } from "@/shared/lib/utils";
import { metiersAssignablesPar } from "@/shared/lib/metiers";
import type { Portail } from "@/shared/hooks/auth-context";
import type { UtilisateursResponse } from "@/shared/types/utilisateur.interface";
import type { AuditAction, AuditActionsResponse } from "@/shared/types/audit-action.interface";
import {
  PeriodDatePicker,
  periodeVersIso,
} from "@/shared/components/date/PeriodDatePicker";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/shared/components/ui/card";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/shared/components/ui/input-group";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Avatar, AvatarFallback } from "@/shared/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/shared/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/shared/components/ui/tooltip";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/shared/components/ui/empty";
import { DetailAuditAction } from "@/shared/components/audit-action/DetailAuditAction";
import {
  BadgeVous, estCompteConnecte, initiales, partieDate,
} from "@/shared/components/audit-connexion/affichage";

const LIBELLES: Record<Portail, { service: { titre: string; sousTitre: string }; moi: { titre: string; sousTitre: string } }> = {
  sp: {
    service: {
      titre: "Audit d'actions SP",
      sousTitre: "Actions enregistrées sur les endpoints du Service de Prévision",
    },
    moi: {
      titre: "Mes actions — SP",
      sousTitre: "Journal de vos actions dans le Service de Prévision",
    },
  },
  sr: {
    service: {
      titre: "Audit d'actions SR",
      sousTitre: "Actions enregistrées sur les endpoints du Service Règlement",
    },
    moi: {
      titre: "Mes actions — SR",
      sousTitre: "Journal de vos actions dans le Service Règlement",
    },
  },
  sof: {
    service: {
      titre: "Audit d'actions SOF",
      sousTitre: "Actions enregistrées sur les endpoints du Service des Opérations Financières",
    },
    moi: {
      titre: "Mes actions — SOF",
      sousTitre: "Journal de vos actions dans le Service des Opérations Financières",
    },
  },
  admin: {
    service: {
      titre: "Audit d'actions",
      sousTitre: "Journal de toutes les actions, tous services confondus",
    },
    moi: {
      titre: "Mes actions",
      sousTitre: "Journal de vos actions sur l'ensemble de la plateforme",
    },
  },
};

const TAILLES_PAGE = [20, 50, 100, 200, 500];

function badgeMethode(methode: string) {
  const map: Record<string, string> = {
    POST: "bg-sky-500/10 text-sky-700",
    PUT: "bg-amber-500/10 text-amber-700",
    PATCH: "bg-amber-500/10 text-amber-700",
    DELETE: "bg-destructive/10 text-destructive",
  };
  return map[methode] ?? "bg-muted text-muted-foreground";
}

function badgeStatut(code: number) {
  if (code >= 200 && code < 300) return "bg-emerald-500/10 text-emerald-700";
  if (code >= 400 && code < 500) return "bg-amber-500/10 text-amber-800";
  if (code >= 500) return "bg-destructive/10 text-destructive";
  return "bg-muted text-muted-foreground";
}

interface AuditActionsProps {
  portail?: Portail;
  portee: "service" | "moi";
}

export default function AuditActions({ portail, portee }: AuditActionsProps) {
  const { user, hasAcces } = useAuth();
  const peutConsulterService =
    hasAcces("CONSULTER_AUDIT_ACTIONS")
    || metiersAssignablesPar(user?.roles ?? []).length > 0;
  const autorise = portee === "moi" || peutConsulterService;

  const libelles = LIBELLES[portail ?? "admin"][portee];

  const [actions, setActions] = useState<AuditAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [detail, setDetail] = useState<AuditAction | null>(null);

  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [periode, setPeriode] = useState<DateRange | undefined>();
  const [methode, setMethode] = useState("all");
  const [filterUtilisateur, setFilterUtilisateur] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState("20");
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [utilisateurs, setUtilisateurs] = useState<{ id: number; label: string }[]>([]);

  const hasActiveFilters = Boolean(
    search || periode?.from || methode !== "all" || filterUtilisateur !== "all",
  );

  useEffect(() => {
    const id = window.setTimeout(() => setSearchDebounced(search.trim()), 350);
    return () => window.clearTimeout(id);
  }, [search]);

  useEffect(() => {
    if (portee !== "service" || !peutConsulterService) return;
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
  }, [portee, peutConsulterService, portail]);

  const charger = useCallback(() => {
    if (!autorise) return Promise.resolve();
    setLoading(true);
    setError(false);
    const { dateDebut, dateFin } = periodeVersIso(periode);
    const params = new URLSearchParams({
      page: String(page),
      limit: pageSize,
      portee,
    });
    if (portail) params.set("portail", portail);
    if (searchDebounced) params.set("search", searchDebounced);
    if (dateDebut) params.set("date_debut", dateDebut);
    if (dateFin) params.set("date_fin", dateFin);
    if (methode !== "all") params.set("methode", methode);
    if (portee === "service" && filterUtilisateur !== "all") {
      params.set("utilisateur_id", filterUtilisateur);
    }

    return requeteApi<AuditActionsResponse>(`${AUDIT_ACTIONS_ENDPOINT}?${params}`)
      .then((data) => {
        setActions(data.actions ?? []);
        setTotal(data.pagination?.total ?? 0);
        setTotalPages(data.pagination?.total_pages ?? 1);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [
    autorise, page, pageSize, portee, portail, searchDebounced,
    periode, methode, filterUtilisateur,
  ]);

  useEffect(() => {
    void charger();
  }, [charger]);

  const resetFiltres = () => {
    setSearch("");
    setSearchDebounced("");
    setPeriode(undefined);
    setMethode("all");
    setFilterUtilisateur("all");
    setPage(1);
  };

  const colSpan = portee === "service" ? (portail ? 7 : 8) : (portail ? 6 : 7);

  if (!autorise) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center p-6">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon" className="bg-destructive/10 text-destructive">
              <ShieldAlert />
            </EmptyMedia>
            <EmptyTitle>Accès refusé</EmptyTitle>
            <EmptyDescription>
              Vous n'avez pas l'autorisation de consulter l'audit d'actions du service.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{libelles.titre}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{libelles.sousTitre}</p>
        </div>

        <Card>
          <CardHeader className="gap-4 space-y-0">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-base">Journal</CardTitle>
                <CardDescription>
                  {total} action{total > 1 ? "s" : ""}
                </CardDescription>
              </div>
            </div>
            <div className="flex w-full flex-wrap items-center gap-2">
              <InputGroup className="min-w-[220px] max-w-md flex-1">
                <InputGroupAddon>
                  <Search className="size-4 text-muted-foreground" />
                </InputGroupAddon>
                <InputGroupInput
                  placeholder="Rechercher un utilisateur, une action, un chemin…"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  aria-label="Rechercher dans l'audit d'actions"
                />
              </InputGroup>
              <Select value={methode} onValueChange={(v) => { setMethode(v); setPage(1); }}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue placeholder="Méthode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes</SelectItem>
                  <SelectItem value="POST">POST</SelectItem>
                  <SelectItem value="PUT">PUT</SelectItem>
                  <SelectItem value="PATCH">PATCH</SelectItem>
                  <SelectItem value="DELETE">DELETE</SelectItem>
                </SelectContent>
              </Select>
              {portee === "service" && (
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
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="icon" onClick={() => { void charger(); }} aria-label="Actualiser">
                    <RefreshCw className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Actualiser</TooltipContent>
              </Tooltip>
              {hasActiveFilters && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="destructive" size="icon" onClick={resetFiltres} aria-label="Réinitialiser les filtres">
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
          </CardHeader>

          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-b-2 border-b-primary/20 bg-muted/60 hover:bg-muted/60">
                  {portee === "service" && (
                    <TableHead className="h-11 text-[11px] font-bold uppercase tracking-wider text-foreground">
                      Utilisateur
                    </TableHead>
                  )}
                  {portee === "service" && (
                    <TableHead className="h-11 text-[11px] font-bold uppercase tracking-wider text-foreground">
                      Métier
                    </TableHead>
                  )}
                  {!portail && (
                    <TableHead className="h-11 text-[11px] font-bold uppercase tracking-wider text-foreground">
                      Service
                    </TableHead>
                  )}
                  <TableHead className="h-11 text-[11px] font-bold uppercase tracking-wider text-foreground">
                    Date
                  </TableHead>
                  <TableHead className="h-11 text-[11px] font-bold uppercase tracking-wider text-foreground">
                    Action
                  </TableHead>
                  <TableHead className="h-11 text-[11px] font-bold uppercase tracking-wider text-foreground">
                    Méthode
                  </TableHead>
                  <TableHead className="h-11 text-[11px] font-bold uppercase tracking-wider text-foreground">
                    Statut
                  </TableHead>
                  <TableHead className="h-11 w-12 text-[11px] font-bold uppercase tracking-wider text-foreground">
                    Détail
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 6 }).map((_, idx) => (
                    <TableRow key={idx}>
                      {Array.from({ length: colSpan }).map((__, c) => (
                        <TableCell key={c}><Skeleton className="h-6 w-24" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : error ? (
                  <TableRow>
                    <TableCell colSpan={colSpan} className="py-10">
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
                ) : actions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={colSpan} className="py-10">
                      <Empty>
                        <EmptyHeader>
                          <EmptyMedia variant="icon">
                            <ScrollText />
                          </EmptyMedia>
                          <EmptyTitle>Aucune action trouvée</EmptyTitle>
                          <EmptyDescription>
                            {hasActiveFilters
                              ? "Essayez de modifier vos filtres."
                              : "Les actions apparaîtront ici dès qu'une opération sera effectuée."}
                          </EmptyDescription>
                        </EmptyHeader>
                      </Empty>
                    </TableCell>
                  </TableRow>
                ) : (
                  actions.map((a) => {
                    const moi = estCompteConnecte(a.utilisateur.email, user?.email);
                    return (
                      <TableRow
                        key={a.id}
                        className={cn(moi && "bg-primary/[0.06] hover:bg-primary/[0.1]")}
                      >
                        {portee === "service" && (
                          <TableCell>
                            <div className="flex items-center gap-2.5">
                              <Avatar className="size-8 shrink-0">
                                <AvatarFallback className={cn("text-[10px]", moi && "bg-primary text-primary-foreground")}>
                                  {initiales(a.utilisateur.nom_complet)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0 leading-tight">
                                <p className="flex items-center gap-1.5 truncate text-sm font-medium">
                                  <span className="truncate">{a.utilisateur.nom_complet}</span>
                                  {moi && <BadgeVous />}
                                </p>
                                <p className="truncate text-xs text-muted-foreground">
                                  {a.utilisateur.matricule || a.utilisateur.email || "—"}
                                </p>
                              </div>
                            </div>
                          </TableCell>
                        )}
                        {portee === "service" && (
                          <TableCell>
                            <Badge className="border-transparent bg-muted font-normal text-muted-foreground">
                              {a.role.libelle}
                            </Badge>
                          </TableCell>
                        )}
                        {!portail && (
                          <TableCell className="text-muted-foreground">
                            {a.portail?.valeur ?? a.module}
                          </TableCell>
                        )}
                        <TableCell className="whitespace-nowrap">
                          <p className="text-sm">{partieDate(a.date_action)}</p>
                          <p className="font-mono text-xs tabular-nums text-muted-foreground">{a.heure_action}</p>
                        </TableCell>
                        <TableCell>
                          <p className="max-w-[320px] truncate text-sm font-medium">{a.action}</p>
                          <p className="max-w-[320px] truncate font-mono text-xs text-muted-foreground">{a.chemin}</p>
                        </TableCell>
                        <TableCell>
                          <Badge className={cn("border-transparent font-mono text-[11px]", badgeMethode(a.methode))}>
                            {a.methode}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={cn("border-transparent font-mono tabular-nums", badgeStatut(a.code_http))}>
                            {a.code_http}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Détail de l'action ${a.action}`}
                            onClick={() => setDetail(a)}
                          >
                            <Eye className="size-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>

          {!loading && !error && total > 0 && (
            <div className="flex items-center justify-between border-t px-4 py-3">
              <div className="flex items-center gap-2">
                <p className="text-xs text-muted-foreground">Lignes par page</p>
                <Select value={pageSize} onValueChange={(v) => { setPageSize(v); setPage(1); }}>
                  <SelectTrigger className="h-8 w-[80px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TAILLES_PAGE.map((n) => (
                      <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">{total} au total</p>
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
                      aria-label="Page précédente"
                      onClick={() => setPage((p) => p - 1)}
                    >
                      <ChevronLeft className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={page === totalPages}
                      aria-label="Page suivante"
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

      <DetailAuditAction
        action={detail}
        portail={portail}
        estMoi={detail ? estCompteConnecte(detail.utilisateur.email, user?.email) : false}
        onClose={() => setDetail(null)}
      />
    </TooltipProvider>
  );
}
