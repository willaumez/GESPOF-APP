import { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import type { DateRange } from "react-day-picker";
import {
  ChevronLeft,
  ChevronRight,
  FileDown,
  FileSearch,
  Inbox,
  Loader2,
  Download,
  MoreVertical,
  Search,
  Trash2,
  X,
  Zap,
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
import { SrPageHeader } from "@/portails/Sr/components/layout/SrPageHeader";
import { ExporterFormatDialog } from "@/portails/Sr/components/export/ExporterFormatDialog";
import {
  COLONNES_LISTE_FICHES,
  exporterTableau,
  type FormatExportSr,
} from "@/portails/Sr/lib/exporter-tableau";

type StatutCfg = { badge: string; label: string; row: string };

const STATUT_CFG: Record<string, StatutCfg> = {
  envoyee: {
    badge: "border-transparent bg-[#ecfdf5] text-[#047857] font-medium",
    label: "Envoyée",
    row: "border-b border-[#f1f5f9]",
  },
  recue: {
    badge: "border-transparent bg-[#fffbeb] text-[#b45309] font-medium",
    label: "Reçue SP",
    row: "border-b border-[#f1f5f9]",
  },
  cree: {
    badge: "border-transparent bg-[#f1f5f9] text-[#475569] font-medium",
    label: "Créée",
    row: "border-b border-[#f1f5f9]",
  },
};

type FiltreChip = "tous" | keyof Stats;

const STATS_CFG: {
  key: FiltreChip;
  label: string;
  hint: string;
}[] = [
  { key: "tous", label: "Toutes", hint: "Toutes les fiches" },
  { key: "cree", label: "Créées", hint: "Brouillons locaux" },
  { key: "envoyee", label: "Envoyées", hint: "Transmises au SP" },
  { key: "recue", label: "Reçues SP", hint: "Accusées par le SP" },
  { key: "en_attente", label: "En attente", hint: "Envoyées non lues" },
];

const PAGE_SIZE_OPTIONS = optionsTaillePagination();
const theme = getPortalMenu("sr").theme;

function statutApiPour(chip: FiltreChip): string {
  if (chip === "tous") return "";
  if (chip === "en_attente") return "envoyee";
  return chip;
}

function chipDepuisQuery(valeur: string | null): FiltreChip {
  if (
    valeur === "cree" ||
    valeur === "envoyee" ||
    valeur === "recue" ||
    valeur === "en_attente"
  ) {
    return valeur;
  }
  return "tous";
}

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
  const [searchParams, setSearchParams] = useSearchParams();
  const { hasAcces } = useAuth();

  const [stats, setStats] = useState<Stats | null>(null);
  const [fiches, setFiches] = useState<Fiche[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filtreChip, setFiltreChip] = useState<FiltreChip>(() =>
    chipDepuisQuery(searchParams.get("filtre")),
  );
  const filterStatut = statutApiPour(filtreChip);
  const [periode, setPeriode] = useState<DateRange | undefined>();
  const [page, setPage] = useState<number>(PAGINATION.PAGE_PAR_DEFAUT);
  const [pageSize, setPageSize] = useState(String(PAGINATION.TAILLE_PAR_DEFAUT));
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [deleting, setDeleting] = useState<Fiche | null>(null);
  const [deletingLoading, setDeletingLoading] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const chip = chipDepuisQuery(searchParams.get("filtre"));
    setFiltreChip(chip);
  }, [searchParams]);

  function appliquerFiltre(chip: FiltreChip) {
    setFiltreChip(chip);
    setPage(1);
    const next = new URLSearchParams(searchParams);
    if (chip === "tous") next.delete("filtre");
    else next.set("filtre", chip);
    setSearchParams(next, { replace: true });
  }

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
    search || filtreChip !== "tous" || periode?.from,
  );

  const resetFilters = () => {
    setSearch("");
    setDebouncedSearch("");
    setPeriode(undefined);
    appliquerFiltre("tous");
  };

  async function exporterListe(format: FormatExportSr) {
    setExporting(true);
    try {
      const { dateDebut, dateFin } = periodeVersIso(periode);
      const params = new URLSearchParams({ page: "1", limit: "all" });
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (filterStatut) params.set("statut", filterStatut);
      if (dateDebut) params.set("date_debut", dateDebut);
      if (dateFin) params.set("date_fin", dateFin);

      const data = await requeteApi<FichesDepotResponse>(
        `${SERVICE_REGLEMENT_ENDPOINTS.FICHES_DEPENSES}?${params.toString()}`,
      );
      const liste = data.fiches ?? [];
      if (liste.length === 0) {
        toast.message("Aucune fiche à exporter.");
        return;
      }

      exporterTableau({
        format,
        titre: "Liste des fiches de dépôt",
        sousTitre: `Pool SR · ${liste.length} fiche${liste.length > 1 ? "s" : ""}`,
        colonnes: COLONNES_LISTE_FICHES,
        lignes: liste.map((f) => ({
          reference: f.reference,
          presentation:
            f.date_presentation_libelle ??
            f.datePresentation ??
            f.date_presentation ??
            "",
          montant: formatMontant(f.montant_total),
          genere_par: f.genere_par,
          statut: STATUT_CFG[f.statut]?.label ?? f.statut,
          creation: formaterDateHeureFr(f.date_creation),
        })),
        nomBase: "liste-fiches-depot",
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

  return (
    <TooltipProvider>
      <div className="flex w-full flex-col gap-6">
        <SrPageHeader
          eyebrow="Pool SR · Consultation"
          title="Liste des fiches de dépôt"
          description="Fiches générées par le Pool SR et transmises au Service de Prévision."
          actions={
            <>
              <button
                type="button"
                onClick={() => setExportOpen(true)}
                className="flex h-[38px] items-center gap-2 rounded-md border border-[#cbd5e1] bg-white px-3.5 text-sm font-medium text-[#0f172a] transition-colors hover:border-[#94a3b8] hover:bg-[#f8fafc]"
              >
                <Download size={16} />
                Exporter
              </button>
              <button
                type="button"
                onClick={() => navigate("/sr/generer")}
                className="flex h-[38px] items-center gap-2 rounded-md px-4 text-sm font-semibold text-white transition-colors"
                style={{ background: theme.ctaColor }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = theme.hoverColor;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = theme.ctaColor;
                }}
              >
                <Zap size={16} />
                Générer une fiche de dépôt
              </button>
            </>
          }
        />

        <ExporterFormatDialog
          open={exportOpen}
          onOpenChange={setExportOpen}
          titre="Exporter la liste"
          description="Choisissez le format de la liste des fiches de dépôt à télécharger."
          loading={exporting}
          onConfirmer={exporterListe}
        />

        {/* Stats / filtres — maquette */}
        <section
          className="grid gap-2.5"
          style={{
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          }}
        >
          {STATS_CFG.map(({ key, label, hint }) => {
            const selected = filtreChip === key;
            const valeur =
              key === "tous"
                ? (stats
                    ? (stats.cree ?? 0) +
                      (stats.envoyee ?? 0) +
                      (stats.recue ?? 0)
                    : total)
                : (stats?.[key] ?? 0);
            return (
              <button
                type="button"
                key={key}
                onClick={() => appliquerFiltre(key)}
                className="flex flex-col gap-0.5 rounded-lg border bg-white px-3.5 py-3 text-left transition-colors"
                style={{
                  borderColor: selected ? theme.topColor : "#e2e8f0",
                  boxShadow: selected
                    ? `inset 0 -3px 0 ${theme.topColor}`
                    : undefined,
                  background: selected ? theme.bgColor : "#fff",
                }}
              >
                <span className="flex items-baseline justify-between gap-2">
                  <span
                    className="text-sm font-semibold"
                    style={{ color: selected ? theme.textColor : "#0f172a" }}
                  >
                    {label}
                  </span>
                  <span className="text-xl font-semibold tabular-nums text-[#0f172a]">
                    {loading ? "—" : error ? "—" : valeur}
                  </span>
                </span>
                <span className="text-xs text-[#64748b]">{hint}</span>
              </button>
            );
          })}
        </section>

        {/* Liste — maquette + filtres statut / période conservés */}
        <section className="flex flex-col rounded-lg border border-[#e2e8f0] bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e2e8f0] px-4 py-3">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
              <div
                className="flex h-9 min-w-[12rem] flex-1 items-center gap-2 rounded-md border border-[#cbd5e1] px-3 text-[#64748b] sm:max-w-[340px]"
              >
                <Search className="size-4 shrink-0" />
                <input
                  placeholder="Rechercher une référence, un agent…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-full min-w-0 flex-1 border-0 bg-transparent text-sm text-[#0f172a] outline-none placeholder:text-[#94a3b8]"
                />
              </div>

              <Select
                value={
                  filtreChip === "tous" || filtreChip === "en_attente"
                    ? filterStatut || "all"
                    : filtreChip
                }
                onValueChange={(v) => {
                  appliquerFiltre(
                    v === "all"
                      ? "tous"
                      : (v as "cree" | "envoyee" | "recue"),
                  );
                }}
              >
                <SelectTrigger className="h-9 w-[150px] border border-[#cbd5e1] bg-white">
                  <SelectValue placeholder="Tous les statuts" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  <SelectItem value="cree">Créée</SelectItem>
                  <SelectItem value="envoyee">Envoyée</SelectItem>
                  <SelectItem value="recue">Reçue SP</SelectItem>
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
                      onClick={resetFilters}
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
                : `${total} fiche${total !== 1 ? "s" : ""}`}
            </span>
          </div>

          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-b border-[#e2e8f0] bg-[#f8fafc]">
                <TableHead className="h-10 px-4 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-[#64748b]">
                  Référence
                </TableHead>
                <TableHead className="h-10 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-[#64748b]">
                  Présentation
                </TableHead>
                <TableHead className="h-10 text-right text-[11.5px] font-semibold uppercase tracking-[0.06em] text-[#64748b]">
                  Montant (FCFA)
                </TableHead>
                <TableHead className="h-10 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-[#64748b]">
                  Généré par
                </TableHead>
                <TableHead className="h-10 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-[#64748b]">
                  Statut
                </TableHead>
                <TableHead className="h-10 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-[#64748b]">
                  Création
                </TableHead>
                <TableHead className="h-10 w-10" />
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
                      <Skeleton className="ml-auto h-4 w-28" />
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
                    <TableCell>
                      <Skeleton className="h-4 w-28" />
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
                            ? "Aucune fiche ne correspond à ces critères."
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
                      className={cn(
                        "cursor-pointer text-sm hover:bg-[#f8fafc]",
                        st.row,
                      )}
                      onClick={() =>
                        navigate(
                          `/sr/fiche/${encodeURIComponent(f.reference)}`,
                        )
                      }
                    >
                      <TableCell
                        className="px-4 font-mono text-[13px] font-medium"
                        style={{
                          fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
                          color: theme.textColor,
                        }}
                      >
                        {f.reference}
                      </TableCell>
                      <TableCell className="tabular-nums text-[#475569]">
                        {formaterDateSansHeure(
                          f.datePresentation ??
                            f.date_presentation_libelle ??
                            f.date_presentation,
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="font-semibold tabular-nums text-[#0f172a]">
                          {formatMontant(f.montant_total)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <Avatar size="sm">
                            <AvatarFallback
                              className="text-[11px] font-semibold"
                              style={{
                                background: theme.iconBg,
                                color: theme.textColor,
                              }}
                            >
                              {initiales(f.genere_par)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-[#0f172a]">{f.genere_par}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={cn("rounded px-2.5 py-0.5 text-xs", st.badge)}>
                          {st.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="tabular-nums text-[#475569]">
                        {formaterDateHeureFr(f.date_creation)}
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
          </div>

          {!loading && !error && total > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e2e8f0] px-4 py-3 text-[13px] text-[#64748b]">
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
