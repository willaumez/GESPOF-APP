import { useState, useEffect, useCallback } from "react";
import type { DateRange } from "react-day-picker";
import {
  Search, UserPlus, Pencil, KeyRound, Ban, RotateCcw, Loader2, Inbox, ShieldAlert, X,
  ChevronLeft, ChevronRight, Trash2, LayoutList, LayoutGrid, Mail, IdCard, Clock, MoreVertical,
} from "lucide-react";
import { toast } from "sonner";
import { requeteApi } from "@/shared/lib/api";
import { PAGINATION } from "@/shared/config/app";
import { UTILISATEURS_ENDPOINT } from "@/shared/api/utilisateurs";
import { optionsTaillePagination } from "@/shared/lib/pagination";
import { useAuth } from "@/shared/hooks/use-auth";
import { cn } from "@/shared/lib/utils";
import { infoMetier, grouperMetiers, metiersAssignablesPar } from "@/shared/lib/metiers";
import type { Portail, RoleUtilisateur } from "@/shared/hooks/auth-context";
import type { Utilisateur, UtilisateursResponse } from "@/shared/types/utilisateur.interface";
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
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel,
} from "@/shared/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/shared/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/shared/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/shared/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/shared/components/ui/empty";
import { DialogNouvelUtilisateur } from "./DialogNouvelUtilisateur";
import { DialogModifierUtilisateur } from "./DialogModifierUtilisateur";
import { DialogDesactiverUtilisateur } from "./DialogDesactiverUtilisateur";
import { DialogSupprimerUtilisateur } from "./DialogSupprimerUtilisateur";
import { DialogReinitialiserMotDePasse } from "./DialogReinitialiserMotDePasse";

/**
 * Gestion des utilisateurs — composant transverse partagé par les 4 portails.
 *
 * - Avec `portail` (sr / sof / sp) : liste et création limitées aux métiers
 *   de CE service (l'admin inclus, s'il ouvre la page du service).
 * - Sans `portail` (page Admin) : tous les utilisateurs gérables.
 */

type VueUtilisateurs = "liste" | "cartes";

const LIBELLES_PORTAIL: Record<Portail, { titre: string; sousTitre: string }> = {
  sp: {
    titre: "Utilisateurs SP",
    sousTitre: "Comptes du Service de Prévision uniquement",
  },
  sr: {
    titre: "Utilisateurs SR",
    sousTitre: "Comptes du Service Règlement uniquement",
  },
  sof: {
    titre: "Utilisateurs SOF",
    sousTitre: "Comptes du Service des Opérations Financières uniquement",
  },
  admin: {
    titre: "Gestion des utilisateurs",
    sousTitre: "Tous les services et métiers",
  },
};

function classeBadgeMetier(valeur: string): string {
  const info = infoMetier(valeur as RoleUtilisateur);
  if (!info) return "border-transparent bg-muted text-muted-foreground";
  if (info.actions.includes("SUPPRIMER")) return "border-transparent bg-primary/10 text-primary";
  if (info.portail === null) return "border-transparent bg-secondary text-secondary-foreground";
  return "border-transparent bg-muted text-muted-foreground";
}

function initiales(u: Utilisateur): string {
  const a = (u.prenom?.[0] ?? "").toUpperCase();
  const b = (u.nom?.[0] ?? "").toUpperCase();
  return `${a}${b}` || "?";
}

function estCompteConnecte(emailUtilisateur: string, emailSession: string | undefined): boolean {
  return !!emailSession && emailUtilisateur.toLowerCase() === emailSession.toLowerCase();
}

function BadgeVous() {
  return (
    <Badge className="border-transparent bg-primary px-1.5 py-0 text-[10px] font-semibold uppercase tracking-wide text-primary-foreground">
      Vous
    </Badge>
  );
}

const PAGE_SIZE_OPTIONS = optionsTaillePagination();

interface ActionsProps {
  utilisateur: Utilisateur;
  reactivatingId: number | null;
  onEdit: (u: Utilisateur) => void;
  onReset: (u: Utilisateur) => void;
  onDeactivate: (u: Utilisateur) => void;
  onReactivate: (u: Utilisateur) => void;
  onDelete: (u: Utilisateur) => void;
}

function ActionsUtilisateur({
  utilisateur: u,
  reactivatingId,
  onEdit,
  onReset,
  onDeactivate,
  onReactivate,
  onDelete,
}: ActionsProps) {
  const reactivationEnCours = reactivatingId === u.id;

  return (
    <div className="flex justify-end">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label={`Actions pour ${u.prenom} ${u.nom}`}
          >
            <MoreVertical className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>Actions</DropdownMenuLabel>
          <DropdownMenuItem onSelect={() => onEdit(u)}>
            <Pencil className="size-4 text-amber-600 dark:text-amber-400" />
            Modifier
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onReset(u)}>
            <KeyRound className="size-4 text-violet-600 dark:text-violet-400" />
            Réinitialiser le mot de passe
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {u.actif ? (
            <DropdownMenuItem variant="destructive" onSelect={() => onDeactivate(u)}>
              <Ban className="size-4" />
              Désactiver
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              disabled={reactivationEnCours}
              onSelect={() => onReactivate(u)}
            >
              {reactivationEnCours
                ? <Loader2 className="size-4 animate-spin text-emerald-600 dark:text-emerald-400" />
                : <RotateCcw className="size-4 text-emerald-600 dark:text-emerald-400" />}
              Réactiver
            </DropdownMenuItem>
          )}
          <DropdownMenuItem variant="destructive" onSelect={() => onDelete(u)}>
            <Trash2 className="size-4" />
            Supprimer
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export default function GestionUtilisateurs({ portail }: { portail?: Portail }) {
  const { user, hasRole } = useAuth();
  const estAdministrateur = hasRole("ADMINISTRATEUR");
  const metiersAssignablesParRole = metiersAssignablesPar(user?.roles ?? []);
  const metiersAssignables = portail
    ? metiersAssignablesParRole.filter((m) => m.portail === portail)
    : metiersAssignablesParRole;
  const peutGerer = metiersAssignables.length > 0;
  const groupesMetiers = grouperMetiers(metiersAssignables);
  const libelles = LIBELLES_PORTAIL[portail ?? "admin"];

  const [vue, setVue] = useState<VueUtilisateurs>("liste");
  const [utilisateurs, setUtilisateurs] = useState<Utilisateur[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filterMetier, setFilterMetier] = useState("all");
  const [filterStatut, setFilterStatut] = useState("all");
  const [periode, setPeriode] = useState<DateRange | undefined>();
  const [page, setPage] = useState<number>(PAGINATION.PAGE_PAR_DEFAUT);
  const [pageSize, setPageSize] = useState(String(PAGINATION.TAILLE_PAR_DEFAUT));
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [openCreate, setOpenCreate] = useState(false);
  const [editing, setEditing] = useState<Utilisateur | null>(null);
  const [deactivating, setDeactivating] = useState<Utilisateur | null>(null);
  const [deleting, setDeleting] = useState<Utilisateur | null>(null);
  const [resettingUser, setResettingUser] = useState<Utilisateur | null>(null);
  const [reactivatingId, setReactivatingId] = useState<number | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const chargerUtilisateurs = useCallback(() => {
    setLoading(true);
    setError(false);
    const params = new URLSearchParams({ page: String(page), limit: pageSize });
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (filterMetier !== "all") params.set("role", filterMetier);
    if (filterStatut !== "all") params.set("statut", filterStatut);
    const { dateDebut, dateFin } = periodeVersIso(periode);
    if (dateDebut) params.set("date_debut", dateDebut);
    if (dateFin) params.set("date_fin", dateFin);
    // Restreint la liste au service de la page (ignoré sur Admin).
    if (portail) params.set("portail", portail);
    return requeteApi<UtilisateursResponse>(`${UTILISATEURS_ENDPOINT}?${params.toString()}`)
      .then((data) => {
        setUtilisateurs(data.utilisateurs ?? []);
        setTotal(data.pagination?.total ?? 0);
        setTotalPages(Math.max(1, data.pagination?.total_pages ?? 1));
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [debouncedSearch, filterMetier, filterStatut, page, pageSize, periode, portail]);

  useEffect(() => {
    if (!peutGerer) return;
    Promise.resolve().then(() => chargerUtilisateurs());
  }, [chargerUtilisateurs, peutGerer]);

  const hasActiveFilters = Boolean(
    search || filterMetier !== "all" || filterStatut !== "all" || periode?.from,
  );
  const resetFiltres = () => {
    setSearch("");
    setDebouncedSearch("");
    setFilterMetier("all");
    setFilterStatut("all");
    setPeriode(undefined);
    setPage(1);
  };

  async function reactiver(u: Utilisateur) {
    setReactivatingId(u.id);
    try {
      await requeteApi<{ ok: boolean }>(`${UTILISATEURS_ENDPOINT}/${u.id}/reactiver`, { method: "POST" });
      toast.success(`${u.prenom} ${u.nom} a été réactivé(e).`);
      chargerUtilisateurs();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur lors de la réactivation.");
    } finally {
      setReactivatingId(null);
    }
  }

  const actionsProps = {
    reactivatingId,
    onEdit: setEditing,
    onReset: setResettingUser,
    onDeactivate: setDeactivating,
    onReactivate: reactiver,
    onDelete: setDeleting,
  };

  if (!peutGerer) {
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
                Vous n&apos;avez pas les droits nécessaires pour gérer des utilisateurs
                {portail ? " de ce service" : ""}.
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
          <CardHeader className="flex flex-col items-stretch gap-4 border-b py-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <CardTitle>{libelles.titre}</CardTitle>
                <CardDescription className="mt-0.5">
                  {libelles.sousTitre}
                  <span className="mx-1.5 text-muted-foreground/40">·</span>
                  {loading ? "Chargement…" : `${total} utilisateur${total !== 1 ? "s" : ""}`}
                </CardDescription>
              </div>
              <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
                <Button onClick={() => setOpenCreate(true)} className="gap-1.5" disabled={loading}>
                  <UserPlus className="size-4" />
                  Nouvel utilisateur
                </Button>
                <ToggleGroup
                  type="single"
                  value={vue}
                  onValueChange={(v) => {
                    if (v === "liste" || v === "cartes") setVue(v);
                  }}
                  variant="outline"
                  size="sm"
                  className="rounded-lg"
                >
                  <ToggleGroupItem value="liste" aria-label="Vue liste" className="gap-1.5 px-2.5">
                    <LayoutList className="size-3.5" />
                    <span className="hidden sm:inline">Liste</span>
                  </ToggleGroupItem>
                  <ToggleGroupItem value="cartes" aria-label="Vue cartes" className="gap-1.5 px-2.5">
                    <LayoutGrid className="size-3.5" />
                    <span className="hidden sm:inline">Cartes</span>
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>
            </div>

            <div className="flex w-full flex-wrap items-center gap-2">
              <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Nom, email, matricule…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8"
                />
              </div>
              <Select value={filterMetier} onValueChange={(v) => { setFilterMetier(v); setPage(1); }}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Tous les métiers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les métiers</SelectItem>
                  {groupesMetiers.map((g) => (
                    <SelectGroup key={g.groupe}>
                      <SelectLabel>{g.groupe}</SelectLabel>
                      {g.metiers.map((m) => (
                        <SelectItem key={m.metier} value={m.metier}>{m.libelle}</SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterStatut} onValueChange={(v) => { setFilterStatut(v); setPage(1); }}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Tous les statuts" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  <SelectItem value="actif">Actifs</SelectItem>
                  <SelectItem value="inactif">Inactifs</SelectItem>
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
            {vue === "liste" ? (
              <Table>
                <TableHeader>
                  <TableRow className="border-b-2 border-b-primary/20 bg-muted/60 hover:bg-muted/60">
                    <TableHead className="h-11 text-[11px] font-bold uppercase tracking-wider text-foreground">Matricule</TableHead>
                    <TableHead className="h-11 text-[11px] font-bold uppercase tracking-wider text-foreground">Nom complet</TableHead>
                    <TableHead className="h-11 text-[11px] font-bold uppercase tracking-wider text-foreground">Email</TableHead>
                    <TableHead className="h-11 text-[11px] font-bold uppercase tracking-wider text-foreground">Métier</TableHead>
                    <TableHead className="h-11 text-[11px] font-bold uppercase tracking-wider text-foreground">Statut</TableHead>
                    <TableHead className="h-11 text-[11px] font-bold uppercase tracking-wider text-foreground">Dernière connexion</TableHead>
                    <TableHead className="h-11 text-right text-[11px] font-bold uppercase tracking-wider text-foreground">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    Array.from({ length: 5 }).map((_, idx) => (
                      <TableRow key={idx}>
                        <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-36" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-44" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-32" /></TableCell>
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
                  ) : utilisateurs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-10">
                        <Empty>
                          <EmptyHeader>
                            <EmptyMedia variant="icon"><Inbox /></EmptyMedia>
                            <EmptyTitle>Aucun utilisateur trouvé</EmptyTitle>
                            <EmptyDescription>
                              Essayez de modifier votre recherche ou vos filtres.
                            </EmptyDescription>
                          </EmptyHeader>
                        </Empty>
                      </TableCell>
                    </TableRow>
                  ) : (
                    utilisateurs.map((u) => {
                      const moi = estCompteConnecte(u.email, user?.email);
                      return (
                      <TableRow
                        key={u.id}
                        className={cn(
                          moi && "bg-primary/[0.06] hover:bg-primary/[0.1]",
                          !u.actif && !moi && "bg-destructive/5 hover:bg-destructive/10",
                        )}
                      >
                        <TableCell className="font-mono text-muted-foreground">{u.matricule}</TableCell>
                        <TableCell className={cn("font-medium", u.actif ? "text-foreground" : "text-destructive")}>
                          <span className="inline-flex items-center gap-1.5">
                            {u.nom} {u.prenom}
                            {moi && <BadgeVous />}
                          </span>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{u.email}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {u.roles.length === 0
                              ? <span className="text-muted-foreground">—</span>
                              : u.roles.map((r) => (
                                  <Badge key={r.valeur} className={classeBadgeMetier(r.valeur)}>
                                    {r.libelle}
                                  </Badge>
                                ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={u.actif
                            ? "border-transparent bg-accent/10 text-accent"
                            : "border-transparent bg-destructive/10 text-destructive"}>
                            {u.actif ? "Actif" : "Inactif"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{u.derniere_connexion ?? "—"}</TableCell>
                        <TableCell className="text-right">
                          <ActionsUtilisateur utilisateur={u} {...actionsProps} />
                        </TableCell>
                      </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            ) : (
              <div className="p-4">
                {loading ? (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className="rounded-2xl border p-4">
                        <div className="flex items-center gap-3">
                          <Skeleton className="size-12 rounded-full" />
                          <div className="flex-1 space-y-2">
                            <Skeleton className="h-4 w-32" />
                            <Skeleton className="h-3 w-24" />
                          </div>
                        </div>
                        <Skeleton className="mt-4 h-3 w-full" />
                        <Skeleton className="mt-2 h-3 w-2/3" />
                      </div>
                    ))}
                  </div>
                ) : error ? (
                  <Empty>
                    <EmptyHeader>
                      <EmptyMedia variant="icon" className="bg-destructive/10 text-destructive">
                        <Inbox />
                      </EmptyMedia>
                      <EmptyTitle>Erreur de chargement</EmptyTitle>
                      <EmptyDescription>Veuillez rafraîchir la page.</EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                ) : utilisateurs.length === 0 ? (
                  <Empty>
                    <EmptyHeader>
                      <EmptyMedia variant="icon"><Inbox /></EmptyMedia>
                      <EmptyTitle>Aucun utilisateur trouvé</EmptyTitle>
                      <EmptyDescription>
                        Essayez de modifier votre recherche ou vos filtres.
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                ) : (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {utilisateurs.map((u) => {
                      const moi = estCompteConnecte(u.email, user?.email);
                      return (
                      <article
                        key={u.id}
                        className={cn(
                          "group flex flex-col rounded-2xl border bg-card p-4 shadow-sm transition-shadow hover:shadow-md",
                          moi && "border-primary/40 bg-primary/[0.04] ring-1 ring-primary/20",
                          !u.actif && !moi && "border-destructive/25 bg-destructive/[0.03]",
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <Avatar size="lg" className="size-12">
                            <AvatarFallback
                              className={cn(
                                "text-sm font-semibold",
                                moi
                                  ? "bg-primary text-primary-foreground"
                                  : u.actif
                                    ? "bg-primary/10 text-primary"
                                    : "bg-destructive/10 text-destructive",
                              )}
                            >
                              {initiales(u)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <h3 className={cn(
                              "flex flex-wrap items-center gap-1.5 text-[14.5px] font-semibold leading-tight",
                              u.actif ? "text-foreground" : "text-destructive",
                            )}>
                              <span className="truncate">{u.prenom} {u.nom}</span>
                              {moi && <BadgeVous />}
                            </h3>
                            <p className="mt-0.5 flex items-center gap-1 font-mono text-[11.5px] text-muted-foreground">
                              <IdCard className="size-3 shrink-0" />
                              {u.matricule}
                            </p>
                          </div>
                          <div className="flex shrink-0 items-start gap-0.5">
                            <Badge className={u.actif
                              ? "mt-1 border-transparent bg-emerald-100 text-emerald-800"
                              : "mt-1 border-transparent bg-destructive/10 text-destructive"}>
                              {u.actif ? "Actif" : "Inactif"}
                            </Badge>
                            <ActionsUtilisateur utilisateur={u} {...actionsProps} />
                          </div>
                        </div>

                        <div className="mt-3 space-y-1.5 text-[12.5px] text-muted-foreground">
                          <p className="flex items-center gap-1.5 truncate">
                            <Mail className="size-3.5 shrink-0" />
                            <span className="truncate">{u.email}</span>
                          </p>
                          <p className="flex items-center gap-1.5">
                            <Clock className="size-3.5 shrink-0" />
                            {u.derniere_connexion ?? "Jamais connecté"}
                          </p>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-1">
                          {u.roles.length === 0
                            ? <span className="text-[12px] text-muted-foreground">Aucun métier</span>
                            : u.roles.map((r) => (
                                <Badge key={r.valeur} className={classeBadgeMetier(r.valeur)}>
                                  {r.libelle}
                                </Badge>
                              ))}
                        </div>
                      </article>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </CardContent>

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

      {openCreate && (
        <DialogNouvelUtilisateur
          groupesMetiers={groupesMetiers}
          metierParDefaut={metiersAssignables.length === 1 ? metiersAssignables[0].metier : ""}
          estAdministrateur={estAdministrateur}
          onClose={() => setOpenCreate(false)}
          onCreated={chargerUtilisateurs}
        />
      )}

      {editing && (
        <DialogModifierUtilisateur
          key={editing.id}
          utilisateur={editing}
          groupesMetiers={groupesMetiers}
          estAdministrateur={estAdministrateur}
          onClose={() => setEditing(null)}
          onModifie={chargerUtilisateurs}
        />
      )}

      {deactivating && (
        <DialogDesactiverUtilisateur
          utilisateur={deactivating}
          onClose={() => setDeactivating(null)}
          onDesactive={chargerUtilisateurs}
        />
      )}

      {deleting && (
        <DialogSupprimerUtilisateur
          utilisateur={deleting}
          onClose={() => setDeleting(null)}
          onSupprime={chargerUtilisateurs}
        />
      )}

      {resettingUser && (
        <DialogReinitialiserMotDePasse
          utilisateur={resettingUser}
          onClose={() => setResettingUser(null)}
          onReinitialise={chargerUtilisateurs}
        />
      )}
    </TooltipProvider>
  );
}
