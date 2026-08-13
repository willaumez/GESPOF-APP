import { useState, useEffect, useCallback } from "react";
import {
  Search, UserPlus, Pencil, KeyRound, Ban, RotateCcw, Copy, Check,
  TriangleAlert, Loader2, Inbox, ShieldAlert, X, Eye, EyeOff,
  ChevronLeft, ChevronRight, Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { requeteApi, ErreurApi } from "@/lib/api";
import { API_ENDPOINTS, PAGINATION } from "@/config/app";
import { optionsTaillePagination } from "@/lib/pagination";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import type { UtilisateurSR, UtilisateurCree, RoleSR, UtilisateursSRResponse } from "@/interfaces/pool-sr";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel,
  AlertDialogMedia,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty";

const ROLE_BADGE: Record<string, string> = {
  CHEF_SR:  "border-transparent bg-primary/10 text-primary",
  AGENT_SR: "border-transparent bg-muted text-muted-foreground",
};

const ROLE_OPTIONS: { value: RoleSR; label: string }[] = [
  { value: "AGENT_SR", label: "Agent SR" },
  { value: "CHEF_SR",  label: "Chef SR" },
];

const ROLE_FILTER_OPTIONS = [
  { value: "all",      label: "Tous les rôles" },
  { value: "AGENT_SR", label: "Agent SR" },
  { value: "CHEF_SR",  label: "Chef SR" },
];

const STATUT_FILTER_OPTIONS = [
  { value: "all",      label: "Tous les statuts" },
  { value: "actif",    label: "Actifs" },
  { value: "inactif",  label: "Inactifs" },
];

const PAGE_SIZE_OPTIONS = optionsTaillePagination();

type ModeMdp = "auto" | "manuel";
type ErreursCreation = Partial<Record<
  "matricule" | "email" | "nom" | "prenom" | "roles" | "mdp" | "mdpConfirmation" | "general", string
>>;
type ErreursModification = Partial<Record<"nom" | "prenom" | "roles" | "general", string>>;

export default function UtilisateursSR() {
  const { hasRole } = useAuth();
  const peutGerer = hasRole("CHEF_SR");

  const [utilisateurs, setUtilisateurs] = useState<UtilisateurSR[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(false);

  const [search,          setSearch]          = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filterRole,      setFilterRole]      = useState("all");
  const [filterStatut,    setFilterStatut]    = useState("all");
  const [page,            setPage]            = useState<number>(PAGINATION.PAGE_PAR_DEFAUT);
  const [pageSize,        setPageSize]        = useState(String(PAGINATION.TAILLE_PAR_DEFAUT));
  const [total,           setTotal]           = useState(0);
  const [totalPages,      setTotalPages]      = useState(1);

  const [openCreate,  setOpenCreate]  = useState(false);
  const [editing,     setEditing]     = useState<UtilisateurSR | null>(null);
  const [deactivating, setDeactivating] = useState<UtilisateurSR | null>(null);
  const [reactivatingId, setReactivatingId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<UtilisateurSR | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [resetState,  setResetState]  = useState<{ user: UtilisateurSR; mdp?: string } | null>(null);
  const [resetLoading, setResetLoading] = useState(false);
  const [copieMdpReset, setCopieMdpReset] = useState(false);

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
    if (filterRole !== "all") params.set("role", filterRole);
    if (filterStatut !== "all") params.set("statut", filterStatut);
    return requeteApi<UtilisateursSRResponse>(`${API_ENDPOINTS.POOL_SR.UTILISATEURS}?${params.toString()}`)
      .then((data) => {
        setUtilisateurs(data.utilisateurs ?? []);
        setTotal(data.pagination?.total ?? 0);
        setTotalPages(Math.max(1, data.pagination?.total_pages ?? 1));
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [debouncedSearch, filterRole, filterStatut, page, pageSize]);

  useEffect(() => {
    if (!peutGerer) return;
    Promise.resolve().then(() => chargerUtilisateurs());
  }, [chargerUtilisateurs, peutGerer]);

  const hasActiveFilters = Boolean(search || filterRole !== "all" || filterStatut !== "all");
  const resetFiltres = () => {
    setSearch("");
    setDebouncedSearch("");
    setFilterRole("all");
    setFilterStatut("all");
    setPage(1);
  };

  async function reactiver(u: UtilisateurSR) {
    setReactivatingId(u.id);
    try {
      await requeteApi<{ ok: boolean }>(
        `${API_ENDPOINTS.POOL_SR.UTILISATEURS}/${u.id}/reactiver`,
        { method: "POST" }
      );
      toast.success(`${u.prenom} ${u.nom} a été réactivé(e).`);
      chargerUtilisateurs();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur lors de la réactivation.");
    } finally {
      setReactivatingId(null);
    }
  }

  async function desactiver() {
    if (!deactivating) return;
    const cible = deactivating;
    try {
      await requeteApi<{ ok: boolean }>(
        `${API_ENDPOINTS.POOL_SR.UTILISATEURS}/${cible.id}/desactiver`,
        { method: "POST" }
      );
      toast.success(`${cible.prenom} ${cible.nom} a été désactivé(e).`);
      chargerUtilisateurs();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur lors de la désactivation.");
    } finally {
      setDeactivating(null);
    }
  }

  async function supprimer() {
    if (!deleting) return;
    const cible = deleting;
    setDeleteLoading(true);
    try {
      await requeteApi<{ ok: boolean }>(
        `${API_ENDPOINTS.POOL_SR.UTILISATEURS}/${cible.id}`,
        { method: "DELETE" }
      );
      toast.success(`${cible.prenom} ${cible.nom} a été supprimé(e) définitivement.`);
      chargerUtilisateurs();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur lors de la suppression.");
    } finally {
      setDeleteLoading(false);
      setDeleting(null);
    }
  }

  async function confirmerReset() {
    if (!resetState) return;
    setResetLoading(true);
    try {
      const res = await requeteApi<{ ok: boolean; mot_de_passe_temporaire: string }>(
        `${API_ENDPOINTS.POOL_SR.UTILISATEURS}/${resetState.user.id}/reinitialiser-mot-de-passe`,
        { method: "POST" }
      );
      setResetState({ user: resetState.user, mdp: res.mot_de_passe_temporaire });
      chargerUtilisateurs();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur lors de la réinitialisation.");
      setResetState(null);
    } finally {
      setResetLoading(false);
    }
  }

  async function copierMdpReset() {
    if (!resetState?.mdp) return;
    try {
      await navigator.clipboard.writeText(resetState.mdp);
      setCopieMdpReset(true);
      setTimeout(() => setCopieMdpReset(false), 2000);
    } catch {
      toast.error("Impossible de copier le mot de passe.");
    }
  }

  useEffect(() => {
    setCopieMdpReset(false);
  }, [resetState]);

  const [creerMatricule, setCreerMatricule] = useState("");
  const [creerEmail,     setCreerEmail]     = useState("");
  const [creerNom,       setCreerNom]       = useState("");
  const [creerPrenom,    setCreerPrenom]    = useState("");
  const [creerRoles,     setCreerRoles]     = useState<RoleSR[]>(["AGENT_SR"]);
  const [creerModeMdp,   setCreerModeMdp]   = useState<ModeMdp>("auto");
  const [creerMdp,       setCreerMdp]       = useState("");
  const [creerMdpConfirmation, setCreerMdpConfirmation] = useState("");
  const [creerVoirMdp,   setCreerVoirMdp]   = useState(false);
  const [creerErreurs,   setCreerErreurs]   = useState<ErreursCreation>({});
  const [creerLoading,   setCreerLoading]   = useState(false);
  const [creerCreated,   setCreerCreated]   = useState<UtilisateurCree | null>(null);
  const [copieMdpCree,   setCopieMdpCree]   = useState(false);

  useEffect(() => {
    setCreerMatricule("");
    setCreerEmail("");
    setCreerNom("");
    setCreerPrenom("");
    setCreerRoles(["AGENT_SR"]);
    setCreerModeMdp("auto");
    setCreerMdp("");
    setCreerMdpConfirmation("");
    setCreerVoirMdp(false);
    setCreerErreurs({});
    setCreerLoading(false);
    setCreerCreated(null);
  }, [openCreate]);

  useEffect(() => {
    setCopieMdpCree(false);
  }, [creerCreated]);

  async function copierMdpCree() {
    if (!creerCreated?.mot_de_passe_temporaire) return;
    try {
      await navigator.clipboard.writeText(creerCreated.mot_de_passe_temporaire);
      setCopieMdpCree(true);
      setTimeout(() => setCopieMdpCree(false), 2000);
    } catch {
      toast.error("Impossible de copier le mot de passe.");
    }
  }

  async function soumettreCreation(e: React.FormEvent) {
    e.preventDefault();
    const nouvellesErreurs: ErreursCreation = {};
    if (!creerMatricule.trim()) nouvellesErreurs.matricule = "Le matricule est requis.";
    if (!creerEmail.trim())     nouvellesErreurs.email     = "L'email est requis.";
    if (!creerNom.trim())       nouvellesErreurs.nom        = "Le nom est requis.";
    if (!creerPrenom.trim())    nouvellesErreurs.prenom     = "Le prénom est requis.";
    if (creerRoles.length === 0) nouvellesErreurs.roles      = "Sélectionnez au moins un rôle.";
    if (creerModeMdp === "manuel") {
      if (creerMdp.length < 8) nouvellesErreurs.mdp = "Le mot de passe doit contenir au moins 8 caractères.";
      else if (creerMdp !== creerMdpConfirmation) nouvellesErreurs.mdpConfirmation = "Les mots de passe ne correspondent pas.";
    }
    if (Object.keys(nouvellesErreurs).length > 0) { setCreerErreurs(nouvellesErreurs); return; }

    setCreerErreurs({});
    setCreerLoading(true);
    try {
      const res = await requeteApi<UtilisateurCree>(API_ENDPOINTS.POOL_SR.UTILISATEURS, {
        method: "POST",
        body: JSON.stringify({
          matricule: creerMatricule.trim(), email: creerEmail.trim(),
          nom: creerNom.trim(), prenom: creerPrenom.trim(), roles: creerRoles,
          ...(creerModeMdp === "manuel" ? { mot_de_passe: creerMdp } : {}),
        }),
      });
      setCreerCreated(res);
      chargerUtilisateurs();
    } catch (e) {
      if (e instanceof ErreurApi && (e.status === 409 || e.status === 400)) {
        const msg = e.message.toLowerCase();
        if (msg.includes("matricule")) setCreerErreurs({ matricule: e.message });
        else if (msg.includes("email")) setCreerErreurs({ email: e.message });
        else if (msg.includes("mot de passe")) setCreerErreurs({ mdp: e.message });
        else setCreerErreurs({ general: e.message });
      } else {
        toast.error(e instanceof Error ? e.message : "Erreur lors de la création.");
      }
    } finally {
      setCreerLoading(false);
    }
  }

  const [modifierNom,     setModifierNom]     = useState("");
  const [modifierPrenom,  setModifierPrenom]  = useState("");
  const [modifierRoles,   setModifierRoles]   = useState<RoleSR[]>(["AGENT_SR"]);
  const [modifierErreurs, setModifierErreurs] = useState<ErreursModification>({});
  const [modifierLoading, setModifierLoading] = useState(false);

  useEffect(() => {
    setModifierNom(editing?.nom ?? "");
    setModifierPrenom(editing?.prenom ?? "");
    const rolesInitiaux = (editing?.roles ?? [])
      .map((r) => r.valeur)
      .filter((v): v is RoleSR => v === "AGENT_SR" || v === "CHEF_SR");
    setModifierRoles(rolesInitiaux.length > 0 ? rolesInitiaux : ["AGENT_SR"]);
    setModifierErreurs({});
    setModifierLoading(false);
  }, [editing]);

  async function soumettreModification(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    const nouvellesErreurs: ErreursModification = {};
    if (!modifierNom.trim())    nouvellesErreurs.nom    = "Le nom est requis.";
    if (!modifierPrenom.trim()) nouvellesErreurs.prenom = "Le prénom est requis.";
    if (modifierRoles.length === 0) nouvellesErreurs.roles = "Sélectionnez au moins un rôle.";
    if (Object.keys(nouvellesErreurs).length > 0) { setModifierErreurs(nouvellesErreurs); return; }

    setModifierErreurs({});
    setModifierLoading(true);
    try {
      await requeteApi(`${API_ENDPOINTS.POOL_SR.UTILISATEURS}/${editing.id}`, {
        method: "PATCH",
        body: JSON.stringify({ nom: modifierNom.trim(), prenom: modifierPrenom.trim(), roles: modifierRoles }),
      });
      toast.success("Utilisateur modifié avec succès.");
      chargerUtilisateurs();
      setEditing(null);
    } catch (e) {
      if (e instanceof ErreurApi && e.status === 400) {
        setModifierErreurs({ general: e.message });
      } else {
        toast.error(e instanceof Error ? e.message : "Erreur lors de la modification.");
        setEditing(null);
      }
    } finally {
      setModifierLoading(false);
    }
  }

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
                Vous n'avez pas les droits nécessaires pour gérer les utilisateurs du Service Règlement.
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
          <CardHeader className="flex flex-col items-stretch gap-3 border-b py-4">
            <div>
              <CardTitle>Utilisateurs du Service Règlement</CardTitle>
              <CardDescription>
                {loading ? "Chargement…" : `${total} utilisateur${total !== 1 ? "s" : ""}`}
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Nom, email, matricule…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-94 pl-8"
                  />
                </div>
                <Select value={filterRole} onValueChange={(v) => { setFilterRole(v); setPage(1); }}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Tous les rôles" />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLE_FILTER_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filterStatut} onValueChange={(v) => { setFilterStatut(v); setPage(1); }}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Tous les statuts" />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUT_FILTER_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
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
              <Button onClick={() => setOpenCreate(true)} className="gap-1.5 ml-0" disabled={loading} >
                <UserPlus className="size-4" />
                Nouvel utilisateur
              </Button>
            </div>
          </CardHeader>

          {}
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-b-2 border-b-primary/20 bg-muted/60 hover:bg-muted/60">
                  <TableHead className="h-11 text-[11px] font-bold uppercase tracking-wider text-foreground">Matricule</TableHead>
                  <TableHead className="h-11 text-[11px] font-bold uppercase tracking-wider text-foreground">Nom complet</TableHead>
                  <TableHead className="h-11 text-[11px] font-bold uppercase tracking-wider text-foreground">Email</TableHead>
                  <TableHead className="h-11 text-[11px] font-bold uppercase tracking-wider text-foreground">Rôle</TableHead>
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
                          <EmptyMedia variant="icon">
                            <Inbox />
                          </EmptyMedia>
                          <EmptyTitle>Aucun utilisateur trouvé</EmptyTitle>
                          <EmptyDescription>Essayez de modifier votre recherche ou vos filtres.</EmptyDescription>
                        </EmptyHeader>
                      </Empty>
                    </TableCell>
                  </TableRow>
                ) : (
                  utilisateurs.map((u) => (
                    <TableRow
                      key={u.id}
                      className={cn(!u.actif && "bg-destructive/5 hover:bg-destructive/10")}
                    >
                      <TableCell className="font-mono text-muted-foreground">{u.matricule}</TableCell>
                      <TableCell className={cn("font-medium", u.actif ? "text-foreground" : "text-destructive")}>
                        {u.nom} {u.prenom}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{u.email}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {u.roles.length === 0
                            ? <span className="text-muted-foreground">—</span>
                            : u.roles.map((r) => (
                                <Badge key={r.valeur} className={ROLE_BADGE[r.valeur] ?? ROLE_BADGE.AGENT_SR}>
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
                        <div className="flex items-center justify-end gap-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" onClick={() => setEditing(u)}>
                                <Pencil className="size-4 text-amber-600 dark:text-amber-400" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Modifier</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" onClick={() => setResetState({ user: u })}>
                                <KeyRound className="size-4 text-violet-600 dark:text-violet-400" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Réinitialiser le mot de passe</TooltipContent>
                          </Tooltip>
                          {u.actif ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" onClick={() => setDeactivating(u)}>
                                  <Ban className="size-4 text-destructive" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Désactiver</TooltipContent>
                            </Tooltip>
                          ) : (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  disabled={reactivatingId === u.id}
                                  onClick={() => reactiver(u)}
                                >
                                  {reactivatingId === u.id
                                    ? <Loader2 className="size-4 animate-spin text-emerald-600 dark:text-emerald-400" />
                                    : <RotateCcw className="size-4 text-emerald-600 dark:text-emerald-400" />}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Réactiver</TooltipContent>
                            </Tooltip>
                          )}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" onClick={() => setDeleting(u)}>
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
      <Dialog
        open={openCreate}
        onOpenChange={(o) => { if (!o && creerCreated) return; setOpenCreate(o); }}
      >
        <DialogContent showCloseButton={!creerCreated} className="sm:max-w-lg">
          {creerCreated ? (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent ring-1 ring-accent/15">
                    <Check className="size-4" />
                  </span>
                  <div>
                    <DialogTitle>Utilisateur créé</DialogTitle>
                    <DialogDescription>
                      {creerCreated.prenom} {creerCreated.nom} ({creerCreated.matricule})
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>
              {creerCreated.mot_de_passe_temporaire ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/40 px-4 py-3">
                    <span className="select-all break-all font-mono text-lg font-bold tracking-wide text-foreground">
                      {creerCreated.mot_de_passe_temporaire}
                    </span>
                    <Button type="button" variant="outline" size="sm" onClick={copierMdpCree} className="shrink-0 gap-1.5">
                      {copieMdpCree ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                      {copieMdpCree ? "Copié" : "Copier"}
                    </Button>
                  </div>
                  <p className="flex items-start gap-1.5 text-[12px] text-destructive">
                    <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
                    Ce mot de passe ne sera plus jamais affiché. Communiquez-le à l'utilisateur maintenant.
                  </p>
                </div>
              ) : (
                <p className="rounded-lg border bg-muted/40 px-4 py-3 text-[12.5px] text-muted-foreground">
                  Le mot de passe que vous avez défini est actif dès maintenant.
                </p>
              )}
              <DialogFooter>
                <Button onClick={() => setOpenCreate(false)}>Terminé</Button>
              </DialogFooter>
            </>
          ) : (
            <form onSubmit={soumettreCreation}>
              <DialogHeader>
                <div className="flex items-center gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15">
                    <UserPlus className="size-4" />
                  </span>
                  <div>
                    <DialogTitle>Nouvel utilisateur</DialogTitle>
                    <DialogDescription>Crée un compte Agent SR ou Chef SR.</DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="space-y-4 py-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="us-matricule">Matricule</Label>
                    <Input id="us-matricule" value={creerMatricule} onChange={(e) => setCreerMatricule(e.target.value)} disabled={creerLoading} />
                    {creerErreurs.matricule && <p className="text-[12px] text-destructive">{creerErreurs.matricule}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="us-email">Email</Label>
                    <Input id="us-email" type="email" value={creerEmail} onChange={(e) => setCreerEmail(e.target.value)} disabled={creerLoading} />
                    {creerErreurs.email && <p className="text-[12px] text-destructive">{creerErreurs.email}</p>}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="us-nom">Nom</Label>
                    <Input id="us-nom" value={creerNom} onChange={(e) => setCreerNom(e.target.value)} disabled={creerLoading} />
                    {creerErreurs.nom && <p className="text-[12px] text-destructive">{creerErreurs.nom}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="us-prenom">Prénom</Label>
                    <Input id="us-prenom" value={creerPrenom} onChange={(e) => setCreerPrenom(e.target.value)} disabled={creerLoading} />
                    {creerErreurs.prenom && <p className="text-[12px] text-destructive">{creerErreurs.prenom}</p>}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>Rôles</Label>
                  <div className="flex flex-wrap gap-4">
                    {ROLE_OPTIONS.map((o) => (
                      <label key={o.value} htmlFor={`us-role-${o.value}`} className="flex cursor-pointer items-center gap-2">
                        <Checkbox
                          id={`us-role-${o.value}`}
                          checked={creerRoles.includes(o.value)}
                          onCheckedChange={(checked) => {
                            setCreerRoles((r) => checked ? [...r, o.value] : r.filter((v) => v !== o.value));
                          }}
                          disabled={creerLoading}
                        />
                        <span className="text-[13px] text-foreground">{o.label}</span>
                      </label>
                    ))}
                  </div>
                  {creerErreurs.roles && <p className="text-[12px] text-destructive">{creerErreurs.roles}</p>}
                </div>

                <div className="space-y-1.5">
                  <Label>Mot de passe</Label>
                  <RadioGroup
                    value={creerModeMdp}
                    onValueChange={(v) => setCreerModeMdp(v as ModeMdp)}
                    className="grid-cols-2 gap-2"
                  >
                    <label
                      htmlFor="mdp-auto"
                      className={cn(
                        "flex cursor-pointer items-start gap-2 rounded-lg border p-2.5 transition-colors",
                        creerModeMdp === "auto" ? "border-primary/50 bg-primary/5" : "border-border hover:bg-muted/50"
                      )}
                    >
                      <RadioGroupItem value="auto" id="mdp-auto" className="mt-0.5" disabled={creerLoading} />
                      <span>
                        <span className="block text-[12.5px] font-semibold text-foreground">Génération automatique</span>
                        <span className="block text-[11px] text-muted-foreground">Mot de passe temporaire généré</span>
                      </span>
                    </label>
                    <label
                      htmlFor="mdp-manuel"
                      className={cn(
                        "flex cursor-pointer items-start gap-2 rounded-lg border p-2.5 transition-colors",
                        creerModeMdp === "manuel" ? "border-primary/50 bg-primary/5" : "border-border hover:bg-muted/50"
                      )}
                    >
                      <RadioGroupItem value="manuel" id="mdp-manuel" className="mt-0.5" disabled={creerLoading} />
                      <span>
                        <span className="block text-[12.5px] font-semibold text-foreground">Définir moi-même</span>
                        <span className="block text-[11px] text-muted-foreground">Vous choisissez le mot de passe</span>
                      </span>
                    </label>
                  </RadioGroup>
                </div>

                {creerModeMdp === "manuel" && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="us-mdp">Mot de passe</Label>
                      <div className="relative">
                        <Input
                          id="us-mdp"
                          type={creerVoirMdp ? "text" : "password"}
                          value={creerMdp}
                          onChange={(e) => setCreerMdp(e.target.value)}
                          disabled={creerLoading}
                          className="pr-9"
                          autoComplete="new-password"
                        />
                        <button
                          type="button"
                          tabIndex={-1}
                          onClick={() => setCreerVoirMdp((v) => !v)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                        >
                          {creerVoirMdp ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                        </button>
                      </div>
                      {creerErreurs.mdp && <p className="text-[12px] text-destructive">{creerErreurs.mdp}</p>}
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="us-mdp-confirm">Confirmer</Label>
                      <Input
                        id="us-mdp-confirm"
                        type={creerVoirMdp ? "text" : "password"}
                        value={creerMdpConfirmation}
                        onChange={(e) => setCreerMdpConfirmation(e.target.value)}
                        disabled={creerLoading}
                        autoComplete="new-password"
                      />
                      {creerErreurs.mdpConfirmation && <p className="text-[12px] text-destructive">{creerErreurs.mdpConfirmation}</p>}
                    </div>
                  </div>
                )}

                {creerErreurs.general && <p className="text-[12px] text-destructive">{creerErreurs.general}</p>}
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpenCreate(false)} disabled={creerLoading}>
                  Annuler
                </Button>
                <Button type="submit" disabled={creerLoading} className="gap-1.5">
                  {creerLoading && <Loader2 className="size-3.5 animate-spin" />}
                  Créer
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {}
      <Dialog open={!!editing} onOpenChange={(o) => { if (!o) setEditing(null); }}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={soumettreModification}>
            <DialogHeader>
              <div className="flex items-center gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15">
                  <Pencil className="size-4" />
                </span>
                <div>
                  <DialogTitle>Modifier l'utilisateur</DialogTitle>
                  <DialogDescription>{editing?.matricule} — {editing?.email}</DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-4 py-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="us-edit-nom">Nom</Label>
                  <Input id="us-edit-nom" value={modifierNom} onChange={(e) => setModifierNom(e.target.value)} disabled={modifierLoading} />
                  {modifierErreurs.nom && <p className="text-[12px] text-destructive">{modifierErreurs.nom}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="us-edit-prenom">Prénom</Label>
                  <Input id="us-edit-prenom" value={modifierPrenom} onChange={(e) => setModifierPrenom(e.target.value)} disabled={modifierLoading} />
                  {modifierErreurs.prenom && <p className="text-[12px] text-destructive">{modifierErreurs.prenom}</p>}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Rôles</Label>
                <div className="flex flex-wrap gap-4">
                  {ROLE_OPTIONS.map((o) => (
                    <label key={o.value} htmlFor={`us-edit-role-${o.value}`} className="flex cursor-pointer items-center gap-2">
                      <Checkbox
                        id={`us-edit-role-${o.value}`}
                        checked={modifierRoles.includes(o.value)}
                        onCheckedChange={(checked) => {
                          setModifierRoles((r) => checked ? [...r, o.value] : r.filter((v) => v !== o.value));
                        }}
                        disabled={modifierLoading}
                      />
                      <span className="text-[13px] text-foreground">{o.label}</span>
                    </label>
                  ))}
                </div>
                {modifierErreurs.roles && <p className="text-[12px] text-destructive">{modifierErreurs.roles}</p>}
              </div>
              {modifierErreurs.general && <p className="text-[12px] text-destructive">{modifierErreurs.general}</p>}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditing(null)} disabled={modifierLoading}>
                Annuler
              </Button>
              <Button type="submit" disabled={modifierLoading} className="gap-1.5">
                {modifierLoading && <Loader2 className="size-3.5 animate-spin" />}
                Enregistrer
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {}
      <AlertDialog open={!!deactivating} onOpenChange={(o) => { if (!o) setDeactivating(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-destructive/10 text-destructive">
              <Ban />
            </AlertDialogMedia>
            <AlertDialogTitle>Désactiver cet utilisateur ?</AlertDialogTitle>
            <AlertDialogDescription>
              Ce compte ({deactivating?.prenom} {deactivating?.nom}) ne pourra plus se connecter.
              Il ne s'agit pas d'une suppression : l'historique de l'utilisateur est conservé
              et le compte peut être réactivé à tout moment.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={desactiver}>
              Désactiver
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {}
      <AlertDialog open={!!deleting} onOpenChange={(o) => { if (!o && !deleteLoading) setDeleting(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-destructive/10 text-destructive">
              <Trash2 />
            </AlertDialogMedia>
            <AlertDialogTitle>Supprimer définitivement cet utilisateur ?</AlertDialogTitle>
            <AlertDialogDescription>
              Le compte de {deleting?.prenom} {deleting?.nom} sera supprimé définitivement de la base.
              Cette action est irréversible. Si cet utilisateur a des fiches ou un historique associés,
              la suppression sera refusée — désactivez-le plutôt dans ce cas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteLoading}>Annuler</AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={deleteLoading} onClick={supprimer}>
              {deleteLoading && <Loader2 className="size-3.5 animate-spin" />}
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {}
      <AlertDialog
        open={!!resetState}
        onOpenChange={(o) => { if (!o && !resetState?.mdp) setResetState(null); }}
      >
        <AlertDialogContent>
          {resetState?.mdp ? (
            <>
              <AlertDialogHeader>
                <AlertDialogMedia className="bg-accent/10 text-accent">
                  <Check />
                </AlertDialogMedia>
                <AlertDialogTitle>Nouveau mot de passe généré</AlertDialogTitle>
                <AlertDialogDescription>
                  Pour {resetState.user.prenom} {resetState.user.nom}.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/40 px-4 py-3">
                  <span className="select-all break-all font-mono text-lg font-bold tracking-wide text-foreground">
                    {resetState.mdp}
                  </span>
                  <Button type="button" variant="outline" size="sm" onClick={copierMdpReset} className="shrink-0 gap-1.5">
                    {copieMdpReset ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                    {copieMdpReset ? "Copié" : "Copier"}
                  </Button>
                </div>
                <p className="flex items-start gap-1.5 text-[12px] text-destructive">
                  <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
                  Ce mot de passe ne sera plus jamais affiché. Communiquez-le à l'utilisateur maintenant.
                </p>
              </div>
              <AlertDialogFooter>
                <Button onClick={() => setResetState(null)}>Terminé</Button>
              </AlertDialogFooter>
            </>
          ) : (
            <>
              <AlertDialogHeader>
                <AlertDialogMedia className="bg-primary/10 text-primary">
                  <KeyRound />
                </AlertDialogMedia>
                <AlertDialogTitle>Réinitialiser le mot de passe ?</AlertDialogTitle>
                <AlertDialogDescription>
                  Un nouveau mot de passe temporaire sera généré pour {resetState?.user.prenom} {resetState?.user.nom}.
                  L'ancien mot de passe ne fonctionnera plus.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={resetLoading}>Annuler</AlertDialogCancel>
                <Button onClick={confirmerReset} disabled={resetLoading} className="gap-1.5">
                  {resetLoading && <Loader2 className="size-3.5 animate-spin" />}
                  Réinitialiser
                </Button>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </TooltipProvider>
  );
}
