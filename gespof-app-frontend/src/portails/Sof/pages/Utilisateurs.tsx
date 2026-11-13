import { useCallback, useEffect, useState } from "react";
import {
  Ban,
  Check,
  Inbox,
  KeyRound,
  Loader2,
  Pencil,
  Plus,
  Search,
  ShieldAlert,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { requeteApi } from "@/shared/lib/api";
import { PAGINATION } from "@/shared/config/app";
import { UTILISATEURS_ENDPOINT } from "@/shared/api/utilisateurs";
import { AvatarUtilisateur } from "@/shared/components/utilisateurs/AvatarUtilisateur";
import { optionsTaillePagination } from "@/shared/lib/pagination";
import { useAuth } from "@/shared/hooks/use-auth";
import { getPortalMenu } from "@/shared/config/menu";
import { metiersAssignablesPar, grouperMetiers } from "@/shared/lib/metiers";
import type { Utilisateur, UtilisateursResponse } from "@/shared/types/utilisateur.interface";
import { Skeleton } from "@/shared/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel,
} from "@/shared/components/ui/select";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/shared/components/ui/empty";
import { DialogNouvelUtilisateur } from "@/shared/components/utilisateurs/DialogNouvelUtilisateur";
import { DialogModifierUtilisateur } from "@/shared/components/utilisateurs/DialogModifierUtilisateur";
import { DialogDesactiverUtilisateur } from "@/shared/components/utilisateurs/DialogDesactiverUtilisateur";
import { DialogSupprimerUtilisateur } from "@/shared/components/utilisateurs/DialogSupprimerUtilisateur";
import { DialogReinitialiserMotDePasse } from "@/shared/components/utilisateurs/DialogReinitialiserMotDePasse";
import { SofPageHeader } from "@/portails/Sof/components/layout/SofPageHeader";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";

const theme = getPortalMenu("sof").theme;
const PAGE_SIZE_OPTIONS = optionsTaillePagination();

const PORTAILS_HABIL = [
  { id: "sof", label: "SOF", nom: "Opérations Financières" },
  { id: "sp", label: "SP", nom: "Service de Prévision" },
  { id: "sr", label: "SR", nom: "Service Règlement" },
  { id: "admin", label: "Admin", nom: "Administration" },
] as const;

function rolePrincipal(u: Utilisateur): string {
  return u.roles[0]?.libelle ?? "—";
}

function roleCode(u: Utilisateur): string {
  return u.roles[0]?.valeur ?? "—";
}

function serviceLabel(u: Utilisateur): string {
  const p = u.portails?.[0]?.toUpperCase();
  if (p === "SR" || p === "SP" || p === "SOF" || p === "ADMIN") return p === "ADMIN" ? "Admin" : p;
  if (u.roles.some((r) => r.valeur.includes("SP"))) return "SP";
  if (u.roles.some((r) => r.valeur.includes("SR"))) return "SR";
  if (u.roles.some((r) => r.valeur.includes("SOF"))) return "SOF";
  if (u.roles.some((r) => r.valeur === "ADMINISTRATEUR")) return "Admin";
  return "SP";
}

export default function Utilisateurs() {
  const { user, hasRole } = useAuth();
  const estAdministrateur = hasRole("ADMINISTRATEUR");
  const metiersAssignables = metiersAssignablesPar(user?.roles ?? []).filter(
    (m) => m.portail === "sof",
  );
  const peutGerer = metiersAssignables.length > 0;
  const groupesMetiers = grouperMetiers(metiersAssignables);

  const [utilisateurs, setUtilisateurs] = useState<Utilisateur[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filterMetier, setFilterMetier] = useState("all");
  const [filterStatut, setFilterStatut] = useState("all");
  const [page, setPage] = useState(PAGINATION.PAGE_PAR_DEFAUT);
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

  const charger = useCallback(() => {
    setLoading(true);
    setError(false);
    const params = new URLSearchParams({
      page: String(page),
      limit: pageSize,
      portail: "sof",
    });
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (filterMetier !== "all") params.set("role", filterMetier);
    if (filterStatut !== "all") params.set("statut", filterStatut);
    return requeteApi<UtilisateursResponse>(
      `${UTILISATEURS_ENDPOINT}?${params.toString()}`,
    )
      .then((data) => {
        const list = data.utilisateurs ?? [];
        setUtilisateurs(list);
        setTotal(data.pagination?.total ?? 0);
        setTotalPages(Math.max(1, data.pagination?.total_pages ?? 1));
        setSelectedId((cur) =>
          cur && list.some((u) => u.id === cur) ? cur : null,
        );
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [debouncedSearch, filterMetier, filterStatut, page, pageSize]);

  useEffect(() => {
    if (!peutGerer) return;
    void charger();
  }, [charger, peutGerer]);

  const selected = utilisateurs.find((u) => u.id === selectedId) ?? null;

  async function reactiver(u: Utilisateur) {
    setReactivatingId(u.id);
    try {
      await requeteApi<{ ok: boolean }>(
        `${UTILISATEURS_ENDPOINT}/${u.id}/reactiver`,
        { method: "POST" },
      );
      toast.success(`${u.prenom} ${u.nom} a été réactivé(e).`);
      void charger();
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Erreur lors de la réactivation.",
      );
    } finally {
      setReactivatingId(null);
    }
  }

  const statutFilters = [
    { id: "all", label: "Tous", n: total },
    { id: "actif", label: "Actifs" },
    { id: "inactif", label: "Inactifs" },
  ] as const;

  if (!peutGerer) {
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
              Vous n&apos;avez pas les droits nécessaires pour gérer les
              utilisateurs du Service des Opérations Financières.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <SofPageHeader
        eyebrow="SOF · Administration"
        title="Gestion des utilisateurs"
        description="Comptes nominatifs, rôles et habilitations du Service des Opérations Financières."
        actions={
          <button
            type="button"
            onClick={() => setOpenCreate(true)}
            className="flex h-[38px] items-center gap-2 rounded-md px-4 text-sm font-semibold text-white transition-colors"
            style={{ background: theme.ctaColor }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = theme.hoverColor;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = theme.ctaColor;
            }}
          >
            <Plus size={16} />
            Nouvel utilisateur
          </button>
        }
      />

      <section className="flex w-full min-w-0 flex-col overflow-hidden rounded-lg border border-[#e2e8f0] bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e2e8f0] px-4 py-3">
            <div className="flex h-9 min-w-[12rem] flex-1 items-center gap-2 rounded-md border border-[#cbd5e1] px-3 text-[#64748b] sm:max-w-[300px]">
              <Search className="size-4 shrink-0" />
              <input
                placeholder="Nom, matricule…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-full min-w-0 flex-1 border-0 bg-transparent text-sm text-[#0f172a] outline-none placeholder:text-[#94a3b8]"
              />
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {statutFilters.map((f) => {
                const on = filterStatut === f.id;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => {
                      setFilterStatut(f.id);
                      setPage(1);
                    }}
                    className="flex h-[30px] items-center gap-1.5 rounded-[5px] border px-2.5 text-[12.5px]"
                    style={{
                      background: on ? "#0f172a" : "#fff",
                      color: on ? "#fff" : "#334155",
                      borderColor: on ? "#0f172a" : "#e2e8f0",
                    }}
                  >
                    {f.label}
                    {"n" in f ? (
                      <span className="opacity-70">{f.n}</span>
                    ) : null}
                  </button>
                );
              })}
              <Select
                value={filterMetier}
                onValueChange={(v) => {
                  setFilterMetier(v);
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-[30px] w-[160px] border border-[#e2e8f0] text-[12.5px]">
                  <SelectValue placeholder="Tous les métiers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les métiers</SelectItem>
                  {groupesMetiers.map((g) => (
                    <SelectGroup key={g.groupe}>
                      <SelectLabel>{g.groupe}</SelectLabel>
                      {g.metiers.map((m) => (
                        <SelectItem key={m.metier} value={m.metier}>
                          {m.libelle}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
              {filterMetier !== "all" || filterStatut !== "all" || search ? (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setDebouncedSearch("");
                    setFilterMetier("all");
                    setFilterStatut("all");
                    setPage(1);
                  }}
                  className="grid size-[30px] place-items-center rounded-[5px] border border-[#e2e8f0] text-[#64748b] hover:bg-[#f8fafc]"
                  aria-label="Réinitialiser les filtres"
                >
                  <X className="size-3.5" />
                </button>
              ) : null}
            </div>
          </div>

          <div className="overflow-x-auto">
            <div className="min-w-[760px]">
              <div
                className="grid gap-3 border-b border-[#e2e8f0] bg-[#f8fafc] px-4 py-2.5 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-[#64748b]"
                style={{
                  gridTemplateColumns:
                    "minmax(220px,1.6fr) 80px 150px 170px 150px",
                }}
              >
                <span>Agent</span>
                <span>Service</span>
                <span>Rôle</span>
                <span>Statut</span>
                <span>Dernière connexion</span>
              </div>

              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="grid min-h-[54px] items-center gap-3 border-b border-[#f1f5f9] px-4"
                    style={{
                      gridTemplateColumns:
                        "minmax(220px,1.6fr) 80px 150px 170px 150px",
                    }}
                  >
                    <Skeleton className="h-8 w-48" />
                    <Skeleton className="h-4 w-10" />
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-5 w-16" />
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
                        <Inbox />
                      </EmptyMedia>
                      <EmptyTitle>Erreur de chargement</EmptyTitle>
                      <EmptyDescription>
                        Veuillez rafraîchir la page.
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                </div>
              ) : utilisateurs.length === 0 ? (
                <div className="px-4 py-10 text-sm text-[#64748b]">
                  Aucun utilisateur ne correspond à ces critères.
                </div>
              ) : (
                utilisateurs.map((u) => {
                  const on = u.id === selectedId;
                  const srv = serviceLabel(u);
                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => setSelectedId(u.id)}
                      className="grid w-full min-h-[54px] items-center gap-3 border-b border-[#f1f5f9] px-4 text-left text-sm transition-colors hover:bg-[#f8fafc]"
                      style={{
                        gridTemplateColumns:
                          "minmax(220px,1.6fr) 80px 150px 170px 150px",
                        background: on ? theme.bgColor : "#fff",
                        boxShadow: on
                          ? `inset 3px 0 0 ${theme.topColor}`
                          : undefined,
                      }}
                    >
                      <span className="flex min-w-0 items-center gap-2.5">
                        <AvatarUtilisateur
                          id={u.id}
                          nom={u.nom}
                          prenom={u.prenom}
                          aPhoto={u.a_photo}
                          taille={32}
                          fondInitiales={theme.iconBg}
                          couleurInitiales={theme.textColor}
                        />
                        <span className="flex min-w-0 flex-col leading-tight">
                          <span className="truncate font-medium text-[#0f172a]">
                            {u.prenom} {u.nom}
                          </span>
                          <span
                            className="font-mono text-xs text-[#64748b]"
                            style={{
                              fontFamily:
                                '"IBM Plex Mono", ui-monospace, monospace',
                            }}
                          >
                            {u.matricule}
                          </span>
                        </span>
                      </span>
                      <span className="flex items-center gap-1.5 text-[13px] text-[#0f172a]">
                        <span
                          className="size-[7px] shrink-0"
                          style={{ background: theme.topColor }}
                        />
                        {srv}
                      </span>
                      <span
                        className="font-mono text-xs text-[#334155]"
                        style={{
                          fontFamily:
                            '"IBM Plex Mono", ui-monospace, monospace',
                        }}
                      >
                        {roleCode(u)}
                      </span>
                      <span>
                        <span
                          className="rounded px-2.5 py-0.5 text-xs font-medium"
                          style={{
                            background: u.actif ? "#ecfdf5" : "#fef2f2",
                            color: u.actif ? "#047857" : "#b91c1c",
                          }}
                        >
                          {u.actif ? "Actif" : "Inactif"}
                        </span>
                      </span>
                      <span className="text-[13px] tabular-nums text-[#475569]">
                        {u.derniere_connexion ?? "—"}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
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
                <span className="tabular-nums">
                  Page {page} / {totalPages}
                </span>
              ) : (
                <span>
                  {total} utilisateur{total !== 1 ? "s" : ""}
                </span>
              )}
            </div>
          ) : null}
        </section>

      <Dialog
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null);
        }}
      >
        <DialogContent
          className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[440px]"
          showCloseButton
        >
          {selected ? (
            <>
              <DialogHeader className="sr-only">
                <DialogTitle>
                  {selected.prenom} {selected.nom}
                </DialogTitle>
                <DialogDescription>
                  Détail du compte et habilitations
                </DialogDescription>
              </DialogHeader>

              <div className="flex shrink-0 items-center gap-3.5 border-b border-[#e2e8f0] p-[18px] pr-12">
                <AvatarUtilisateur
                  id={selected.id}
                  nom={selected.nom}
                  prenom={selected.prenom}
                  aPhoto={selected.a_photo}
                  taille={48}
                  fondInitiales={theme.iconBg}
                  couleurInitiales={theme.textColor}
                />
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-base font-semibold leading-snug text-[#0f172a]">
                    {selected.prenom} {selected.nom}
                  </span>
                  <span className="text-[12.5px] leading-snug text-[#64748b]">
                    <span
                      className="font-mono"
                      style={{
                        fontFamily:
                          '"IBM Plex Mono", ui-monospace, monospace',
                      }}
                    >
                      {selected.matricule}
                    </span>
                    {" · "}
                    {rolePrincipal(selected)}
                  </span>
                </span>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto">
                <div className="flex flex-col gap-2.5 border-b border-[#e2e8f0] px-[18px] py-4 text-[13.5px]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="shrink-0 text-[#64748b]">Statut</span>
                    <span
                      className="rounded px-2.5 py-0.5 text-xs font-medium"
                      style={{
                        background: selected.actif ? "#ecfdf5" : "#fef2f2",
                        color: selected.actif ? "#047857" : "#b91c1c",
                      }}
                    >
                      {selected.actif ? "Actif" : "Inactif"}
                    </span>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <span className="shrink-0 text-[#64748b]">
                      Service principal
                    </span>
                    <span className="text-right leading-snug">
                      {serviceLabel(selected)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="shrink-0 text-[#64748b]">
                      Dernière connexion
                    </span>
                    <span className="tabular-nums">
                      {selected.derniere_connexion ?? "—"}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col gap-2.5 border-b border-[#e2e8f0] px-[18px] py-4">
                  <span className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-[#64748b]">
                    Habilitations
                  </span>
                  {PORTAILS_HABIL.map((p) => {
                    const has = (selected.portails ?? []).some(
                      (x) => x.toLowerCase() === p.id,
                    );
                    return (
                      <div key={p.id} className="flex items-center gap-2.5">
                        <span
                          className="grid size-[18px] shrink-0 place-items-center rounded border-[1.5px] text-white"
                          style={{
                            background: has ? theme.ctaColor : "#fff",
                            borderColor: has ? theme.ctaColor : "#cbd5e1",
                          }}
                        >
                          {has ? (
                            <Check className="size-3" strokeWidth={3} />
                          ) : null}
                        </span>
                        <span className="flex min-w-0 flex-1 flex-col leading-tight">
                          <span className="text-[13.5px] font-medium text-[#0f172a]">
                            {p.label}{" "}
                            <span className="font-normal text-[#64748b]">
                              · {p.nom}
                            </span>
                          </span>
                          <span
                            className="font-mono text-[11.5px]"
                            style={{
                              fontFamily:
                                '"IBM Plex Mono", ui-monospace, monospace',
                              color: has ? "#334155" : "#94a3b8",
                            }}
                          >
                            {has
                              ? p.id === "sof"
                                ? roleCode(selected)
                                : `AGENT_${p.label}`
                              : "Aucun accès"}
                          </span>
                        </span>
                      </div>
                    );
                  })}
                </div>

                <div className="flex flex-col gap-2 px-[18px] py-4">
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(selected);
                      setSelectedId(null);
                    }}
                    className="flex h-9 items-center justify-center gap-2 rounded-md border border-[#cbd5e1] bg-white text-[13.5px] hover:bg-[#f8fafc]"
                  >
                    <Pencil className="size-3.5" />
                    Modifier le compte
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setResettingUser(selected);
                      setSelectedId(null);
                    }}
                    className="flex h-9 items-center justify-center gap-2 rounded-md border border-[#cbd5e1] bg-white text-[13.5px] hover:bg-[#f8fafc]"
                  >
                    <KeyRound className="size-3.5" />
                    Réinitialiser le mot de passe
                  </button>
                  <div className="grid grid-cols-2 gap-2">
                    {selected.actif ? (
                      <button
                        type="button"
                        onClick={() => {
                          setDeactivating(selected);
                          setSelectedId(null);
                        }}
                        className="flex h-9 items-center justify-center gap-1.5 rounded-md border border-[#fecaca] bg-white text-[13.5px] text-[#b91c1c] hover:bg-[#fef2f2]"
                      >
                        <Ban className="size-3.5" />
                        Désactiver
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={reactivatingId === selected.id}
                        onClick={() => void reactiver(selected)}
                        className="flex h-9 items-center justify-center gap-1.5 rounded-md border border-[#cbd5e1] bg-white text-[13.5px] hover:bg-[#f8fafc] disabled:opacity-50"
                      >
                        {reactivatingId === selected.id ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : null}
                        Réactiver
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setDeleting(selected);
                        setSelectedId(null);
                      }}
                      className="flex h-9 items-center justify-center gap-1.5 rounded-md border border-[#fecaca] bg-white text-[13.5px] text-[#b91c1c] hover:bg-[#fef2f2]"
                    >
                      <Trash2 className="size-3.5" />
                      Supprimer
                    </button>
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      {openCreate ? (
        <DialogNouvelUtilisateur
          groupesMetiers={groupesMetiers}
          metierParDefaut={
            metiersAssignables.length === 1 ? metiersAssignables[0].metier : ""
          }
          estAdministrateur={estAdministrateur}
          onClose={() => setOpenCreate(false)}
          onCreated={charger}
        />
      ) : null}

      {editing ? (
        <DialogModifierUtilisateur
          key={editing.id}
          utilisateur={editing}
          groupesMetiers={groupesMetiers}
          estAdministrateur={estAdministrateur}
          onClose={() => setEditing(null)}
          onModifie={charger}
        />
      ) : null}

      {deactivating ? (
        <DialogDesactiverUtilisateur
          utilisateur={deactivating}
          onClose={() => setDeactivating(null)}
          onDesactive={charger}
        />
      ) : null}

      {deleting ? (
        <DialogSupprimerUtilisateur
          utilisateur={deleting}
          onClose={() => setDeleting(null)}
          onSupprime={charger}
        />
      ) : null}

      {resettingUser ? (
        <DialogReinitialiserMotDePasse
          utilisateur={resettingUser}
          onClose={() => setResettingUser(null)}
          onReinitialise={charger}
        />
      ) : null}
    </div>
  );
}
